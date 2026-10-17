import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type {
  RightsRequestAdminView,
  RightsRequestView,
} from "@sahmati/contracts";
import { RegisterEntryEntity } from "../../register/entities/register-entry.entity";
import { PublicVerificationSessionEntity } from "../../participants/entities/public-verification-session.entity";
import { RightsRequestEntity } from "../entities/rights-request.entity";
import { SubmitRightsRequestDto } from "../dto/submit-rights-request.dto";
import { RespondRightsRequestDto } from "../dto/respond-rights-request.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { MessageOutboxService } from "../../messaging/services/message-outbox.service";
import type { AuthenticatedParticipant } from "../../common/guards/participant-session.guard";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

const RESPONSE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

@Injectable()
export class RightsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly messageOutbox: MessageOutboxService,
  ) {}

  async submit(
    dto: SubmitRightsRequestDto,
    participant: AuthenticatedParticipant,
  ): Promise<RightsRequestView> {
    const manager = this.tenantContext.manager;
    const tenantId = participant.tenantId;

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const autoAccessSummary =
          dto.kind === "access"
            ? await this.buildAccessSummary(tenantId)
            : null;
        const submittedAt = new Date();
        const row = await manager.save(
          manager.create(RightsRequestEntity, {
            tenantId,
            verificationSessionId: participant.verificationId,
            identifierMasked: this.maskIdentifier(participant.identifier),
            kind: dto.kind,
            details: dto.details,
            status: "requested",
            autoAccessSummary,
            dueAt: new Date(submittedAt.getTime() + RESPONSE_WINDOW_MS),
          }),
        );
        return this.toView(row);
      },
    );
  }

  /**
   * A participant's own requests, scoped to their *current* verified
   * session (see participantOwnRowSql) — a request submitted under an
   * earlier, now-expired session is not visible here until re-verifying
   * reaches the same session id, which it never will across a fresh OTP.
   * Known R1 scope limit: cross-session "track my request" would need an
   * identifier-hash lookup path, deferred past R1.
   */
  async myRequests(
    participant: AuthenticatedParticipant,
  ): Promise<RightsRequestView[]> {
    const rows = await this.tenantContext.repo(RightsRequestEntity).find({
      where: { verificationSessionId: participant.verificationId },
      order: { submittedAt: "DESC" },
    });
    return rows.map((row) => this.toView(row));
  }

  async list(status?: string): Promise<RightsRequestAdminView[]> {
    const tenantId = this.tenantId();
    const where = status
      ? { tenantId, status: status as RightsRequestEntity["status"] }
      : { tenantId };
    const rows = await this.tenantContext
      .repo(RightsRequestEntity)
      .find({ where, order: { submittedAt: "DESC" } });
    return rows.map((row) => ({
      ...this.toView(row),
      identifierMasked: row.identifierMasked,
    }));
  }

  async respond(
    id: string,
    dto: RespondRightsRequestDto,
    session: AuthenticatedSession,
  ): Promise<RightsRequestAdminView> {
    if (session.role === "viewer")
      throw new ForbiddenException("Viewers cannot respond to requests.");
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await manager
          .getRepository(RightsRequestEntity)
          .findOne({ where: { id, tenantId } });
        if (!row) throw new NotFoundException("Request not found.");
        if (row.version !== dto.version) {
          throw new ConflictException(
            "This request changed since you last loaded it.",
          );
        }
        row.status = dto.status;
        row.responseText = dto.responseText;
        row.respondedAt = new Date();
        row.version += 1;
        await manager.save(row);
        await this.notifyParticipant(manager, row);
        return { ...this.toView(row), identifierMasked: row.identifierMasked };
      },
    );
  }

  /**
   * Queues a real notification to the participant's own identifier
   * (resolved from their verification session, never the masked value
   * shown to staff) for the worker process to deliver — the staff member
   * responding should not have to wait on a live SMTP/WhatsApp round-trip.
   * The verification session doesn't track language preference in R1, so
   * this defaults to English; a later pass could persist it at
   * verification time if that gap matters in practice.
   */
  private async notifyParticipant(
    manager: EntityManager,
    row: RightsRequestEntity,
  ): Promise<void> {
    const session = await manager
      .getRepository(PublicVerificationSessionEntity)
      .findOne({ where: { id: row.verificationSessionId } });
    if (!session) return;
    await this.messageOutbox.enqueue(manager, {
      tenantId: row.tenantId,
      recipient: session.identifier,
      language: "en",
      template: "rights_response_ready",
      payload: { kind: row.kind, status: row.status },
    });
  }

  private async buildAccessSummary(tenantId: string): Promise<string> {
    const manager = this.tenantContext.manager;
    const entries = await manager
      .getRepository(RegisterEntryEntity)
      .find({ where: { tenantId } });
    if (entries.length === 0)
      return "No data categories are currently on record for this organisation.";
    const lines = entries.map(
      (entry) =>
        `- ${entry.purposeEn} (retained ${entry.retentionDays} days, ${entry.legalBasis.replace("_", " ")})`,
    );
    return `This organisation holds data for the following purposes:\n${lines.join("\n")}`;
  }

  private maskIdentifier(identifier: string): string {
    if (EMAIL_RE.test(identifier)) {
      const [local, domain] = identifier.split("@");
      return `${local.slice(0, 1)}***@${domain}`;
    }
    return `${identifier.slice(0, 3)}${"*".repeat(Math.max(identifier.length - 5, 0))}${identifier.slice(-2)}`;
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }

  private toView(row: RightsRequestEntity): RightsRequestView {
    return {
      id: row.id,
      kind: row.kind,
      details: row.details,
      status: row.status,
      version: row.version,
      autoAccessSummary: row.autoAccessSummary,
      responseText: row.responseText,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      dueAt: row.dueAt.toISOString(),
      submittedAt: row.submittedAt.toISOString(),
    };
  }
}
