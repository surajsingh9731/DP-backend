import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  ConsentLedgerItemView,
  ConsentOfferItem,
  ConsentReceiptView,
} from "@sahmati/contracts";
import { ConsentReceiptEntity } from "../entities/consent-receipt.entity";
import { WithdrawalFollowupEntity } from "../entities/withdrawal-followup.entity";
import { RecordChoicesDto } from "../dto/record-choices.dto";
import { WithdrawChoicesDto } from "../dto/withdraw-choices.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { NoticesService } from "../../notices/services/notices.service";
import type { AuthenticatedParticipant } from "../../common/guards/participant-session.guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

@Injectable()
export class ConsentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly notices: NoticesService,
  ) {}

  async offerForSlug(
    orgSlug: string,
  ): Promise<{ available: boolean; purposes: ConsentOfferItem[] }> {
    const { available, purposes } =
      await this.notices.publicOfferBySlug(orgSlug);
    return { available, purposes };
  }

  async recordChoices(
    dto: RecordChoicesDto,
    participant: AuthenticatedParticipant,
  ): Promise<ConsentReceiptView> {
    const manager = this.tenantContext.manager;
    const tenantId = participant.tenantId;

    const purposes = await this.notices.publishedPurposesForTenant(tenantId);
    const validIds = new Set(purposes.map((p) => p.registerEntryId));
    for (const choice of dto.choices) {
      if (!validIds.has(choice.registerEntryId)) {
        throw new BadRequestException(
          `Unknown purpose: ${choice.registerEntryId}.`,
        );
      }
    }

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const repo = manager.getRepository(ConsentReceiptEntity);
        const previous = await repo.findOne({
          where: { tenantId },
          order: { occurredAt: "DESC" },
        });
        const previousReceiptHash = previous?.receiptHash ?? null;
        const occurredAt = new Date();
        const receiptHash = this.hashReceipt(
          tenantId,
          participant.verificationId,
          "choices_recorded",
          dto.choices,
          previousReceiptHash,
          occurredAt,
        );

        const receipt = await repo.save(
          repo.create({
            tenantId,
            verificationSessionId: participant.verificationId,
            identifierMasked: this.maskIdentifier(participant.identifier),
            kind: "choices_recorded",
            choices: dto.choices,
            previousReceiptHash,
            receiptHash,
            occurredAt,
          }),
        );
        return this.toReceiptView(receipt);
      },
    );
  }

  async withdraw(
    dto: WithdrawChoicesDto,
    participant: AuthenticatedParticipant,
  ): Promise<ConsentReceiptView> {
    const manager = this.tenantContext.manager;
    const tenantId = participant.tenantId;

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const repo = manager.getRepository(ConsentReceiptEntity);
        const previous = await repo.findOne({
          where: { tenantId },
          order: { occurredAt: "DESC" },
        });
        const previousReceiptHash = previous?.receiptHash ?? null;
        const occurredAt = new Date();
        const choices = dto.registerEntryIds.map((registerEntryId) => ({
          registerEntryId,
          decision: "decline" as const,
        }));
        const receiptHash = this.hashReceipt(
          tenantId,
          participant.verificationId,
          "choices_withdrawn",
          choices,
          previousReceiptHash,
          occurredAt,
        );

        const receipt = await repo.save(
          repo.create({
            tenantId,
            verificationSessionId: participant.verificationId,
            identifierMasked: this.maskIdentifier(participant.identifier),
            kind: "choices_withdrawn",
            choices,
            previousReceiptHash,
            receiptHash,
            occurredAt,
          }),
        );

        // The brief's acceptance criterion: a withdrawal must reach staff as
        // an actionable erasure task immediately, not just a ledger entry.
        await manager.save(
          manager.create(WithdrawalFollowupEntity, {
            tenantId,
            receiptId: receipt.id,
            status: "open",
          }),
        );

        return this.toReceiptView(receipt);
      },
    );
  }

  async ledger(kind?: string): Promise<ConsentLedgerItemView[]> {
    const tenantId = this.tenantId();
    const where = kind
      ? { tenantId, kind: kind as ConsentReceiptEntity["kind"] }
      : { tenantId };
    const rows = await this.tenantContext
      .repo(ConsentReceiptEntity)
      .find({ where, order: { occurredAt: "DESC" } });
    return rows.map((row) => ({
      ...this.toReceiptView(row),
      identifierMasked: row.identifierMasked,
    }));
  }

  async openFollowups(): Promise<
    { id: string; receiptId: string; createdAt: string }[]
  > {
    const tenantId = this.tenantId();
    const rows = await this.tenantContext.repo(WithdrawalFollowupEntity).find({
      where: { tenantId, status: "open" },
      order: { createdAt: "ASC" },
    });
    return rows.map((row) => ({
      id: row.id,
      receiptId: row.receiptId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async closeFollowup(id: string): Promise<void> {
    const tenantId = this.tenantId();
    const row = await this.tenantContext
      .repo(WithdrawalFollowupEntity)
      .findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Follow-up not found.");
    row.status = "done";
    await this.tenantContext.manager.save(row);
  }

  private hashReceipt(
    tenantId: string,
    verificationSessionId: string,
    kind: string,
    choices: unknown,
    previousReceiptHash: string | null,
    occurredAt: Date,
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          tenantId,
          verificationSessionId,
          kind,
          choices,
          previousReceiptHash,
          occurredAt: occurredAt.toISOString(),
        }),
      )
      .digest("hex");
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

  private toReceiptView(row: ConsentReceiptEntity): ConsentReceiptView {
    return {
      id: row.id,
      kind: row.kind,
      choices: row.choices,
      receiptHash: row.receiptHash,
      previousReceiptHash: row.previousReceiptHash,
      occurredAt: row.occurredAt.toISOString(),
    };
  }
}
