import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { createHash } from "node:crypto";
import type {
  ParticipantRightsRequest,
  ParticipantRightsView,
  RightsAction,
  RightsDetail,
  RightsRequest,
  RightsSummary,
} from "@sahmati/contracts";
import { RightsRequestEntity } from "../entities/rights-request.entity";
import { RightsWorkItemEntity } from "../entities/rights-work-item.entity";
import { RightsResponseEntity } from "../entities/rights-response.entity";
import { RightsAuditEventEntity } from "../entities/rights-audit-event.entity";
import { SubmitRightsDto } from "../dto/submit-rights.dto";
import { RightsActionDto } from "../dto/rights-action.dto";
import { ConsentSandboxService } from "../../consent-sandbox/services/consent-sandbox.service";
import { NoticesService } from "../../notices/services/notices.service";
import { RegisterService } from "../../register/services/register.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";
import { MembershipEntity } from "../../auth/entities/membership.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import type { CurrentMembership } from "../../common/guards/tenant-membership.guard";

@Injectable()
export class RightsService {
  constructor(
    @InjectRepository(RightsRequestEntity)
    private readonly requests: Repository<RightsRequestEntity>,
    @InjectRepository(RightsWorkItemEntity)
    private readonly workItems: Repository<RightsWorkItemEntity>,
    @InjectRepository(RightsResponseEntity)
    private readonly responses: Repository<RightsResponseEntity>,
    @InjectRepository(RightsAuditEventEntity)
    private readonly auditEvents: Repository<RightsAuditEventEntity>,
    @InjectRepository(MembershipEntity)
    private readonly memberships: Repository<MembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly idempotency: IdempotencyService,
    private readonly consent: ConsentSandboxService,
    private readonly notices: NoticesService,
    private readonly register: RegisterService,
    private readonly evidence: EvidenceLedgerService,
  ) {}

  // -- Participant-facing (own session) -------------------------------------

  async own(
    tenantId: string,
    sessionId: string,
  ): Promise<ParticipantRightsView> {
    const session = await this.consent.getSession(tenantId, sessionId);
    const rows = await this.requests.find({
      where: { tenantId, sessionId },
      order: { submittedAt: "DESC" },
    });
    const requests = await Promise.all(
      rows.map((row) => this.participantView(row)),
    );
    return {
      sessionId: session.id,
      syntheticReference: session.syntheticReference,
      expiresAt: session.expiresAt,
      requests,
    };
  }

  async submit(
    tenantId: string,
    sessionId: string,
    dto: SubmitRightsDto,
  ): Promise<ParticipantRightsRequest> {
    const session = await this.consent.getSession(tenantId, sessionId);
    const latestReceipt = session.receipts[session.receipts.length - 1];
    const notice = await this.notices.get(tenantId, session.offer.notice.id);

    const row = await this.dataSource.transaction(async (manager) => {
      const request = await manager.save(
        manager.create(RightsRequestEntity, {
          tenantId,
          sessionId,
          syntheticReference: session.syntheticReference,
          kind: dto.kind,
          inputLanguage: dto.inputLanguage,
          details: dto.details,
          correction: dto.correction ?? null,
          source: {
            noticeId: notice.id,
            entryVersion: notice.entryVersion,
            noticeLanguage: notice.language,
            noticeTitle: notice.preview.title,
            offerId: session.offer.id,
            sourceReceiptId: latestReceipt?.id ?? null,
          },
          status: "requested",
          version: 1,
          assignee: null,
        }),
      );
      await this.createWorkItems(manager, tenantId, request.id, notice.entryId);
      await this.appendAudit(
        manager,
        request.id,
        tenantId,
        1,
        "submitted",
        "",
        "participant",
        [],
      );
      await this.evidence.append(manager, {
        tenantId,
        kind: "rights",
        sourceId: request.id,
        version: 1,
        action: "submitted",
        status: request.status,
        provenance: "recorded",
      });
      return request;
    });
    return this.participantView(row);
  }

  // -- Staff/owner triage ----------------------------------------------------

  async list(tenantId: string): Promise<RightsSummary[]> {
    const rows = await this.requests.find({
      where: { tenantId },
      order: { submittedAt: "DESC" },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      syntheticReference: row.syntheticReference,
      status: row.status,
      version: row.version,
      assignee: row.assignee,
      submittedAt: row.submittedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async get(tenantId: string, id: string): Promise<RightsDetail> {
    const row = await this.findOrThrow(tenantId, id);
    return this.detailView(row);
  }

  async act(
    tenantId: string,
    id: string,
    dto: RightsActionDto,
    membership: CurrentMembership,
  ): Promise<RightsRequest> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(
        manager,
        tenantId,
        dto.idempotencyKey,
        async () => {
          const row = await manager.findOne(RightsRequestEntity, {
            where: { id, tenantId },
          });
          if (!row) throw new NotFoundException("Rights request not found.");
          if (row.version !== dto.version) {
            throw new ConflictException(
              "This request changed since you last loaded it.",
            );
          }
          await this.applyAction(manager, tenantId, row, dto, membership);
          row.version += 1;
          await manager.save(row);
          await this.appendAudit(
            manager,
            id,
            tenantId,
            row.version,
            dto.action,
            dto.note,
            membership.userId,
            dto.evidenceRefs,
          );
          await this.evidence.append(manager, {
            tenantId,
            kind: "rights",
            sourceId: id,
            version: row.version,
            action: dto.action,
            status: row.status,
            provenance: "recorded",
            actorId: membership.userId,
            note: dto.note,
            evidenceRefs: dto.evidenceRefs,
          });
          const full = await this.findOrThrow(tenantId, id, manager);
          return this.toRightsRequest(full);
        },
      );
    });
  }

  // -- Internal helpers --------------------------------------------------

  private async createWorkItems(
    manager: import("typeorm").EntityManager,
    tenantId: string,
    requestId: string,
    entryId: string,
  ): Promise<void> {
    const entries = await this.register.list(tenantId);
    const entry = entries.find((row) => row.id === entryId);
    const declared = [
      ...(entry?.vendorReferences ?? []).map((ref) => ({
        kind: "vendor" as const,
        name: ref.name,
        detail: ref.service,
      })),
      ...(entry?.storageReferences ?? []).map((ref) => ({
        kind: (ref.medium === "paper" ? "paper" : "digital") as
          "paper" | "digital",
        name: ref.name,
        detail: ref.location,
      })),
    ];
    const locations =
      declared.length > 0
        ? declared
        : [
            {
              kind: "unmapped" as const,
              name: "other",
              detail: "Unknown coverage.",
            },
          ];
    for (const location of locations) {
      const key = createHash("sha256")
        .update(`${requestId}:${location.kind}:${location.name}`)
        .digest("hex");
      await manager.save(
        manager.create(RightsWorkItemEntity, {
          requestId,
          tenantId,
          version: 1,
          location: {
            key,
            kind: location.kind,
            name: location.name,
            detail: location.detail,
            mapping:
              location.kind === "unmapped"
                ? ("unknown" as const)
                : ("declared" as const),
          },
          status:
            location.kind === "unmapped"
              ? ("unknown" as const)
              : ("pending" as const),
          declaredBy: null,
          declaredEvidence: [],
          relatedFollowupTaskId: null,
        }),
      );
    }
  }

  private async applyAction(
    manager: import("typeorm").EntityManager,
    tenantId: string,
    row: RightsRequestEntity,
    dto: RightsActionDto,
    membership: CurrentMembership,
  ): Promise<void> {
    const owner = membership.role === "owner";

    if (dto.action === "assign") {
      if (!owner)
        throw new ForbiddenException("Only an owner can assign this request.");
      row.assignee = dto.assigneeId
        ? await this.resolveAssignee(tenantId, dto.assigneeId)
        : null;
      return;
    }
    if (row.status === "closed") {
      if (dto.action === "reopen" && owner) {
        row.status = "under_review";
        return;
      }
      throw new ForbiddenException(
        "This request is closed; only an owner can reopen it.",
      );
    }
    if (row.status === "responded") {
      if (dto.action === "close") {
        if (!owner)
          throw new ForbiddenException("Only an owner can close this request.");
        const unresolved = await this.unresolvedCount(tenantId, row.id);
        if (unresolved > 0 && !dto.unresolvedAcknowledged) {
          throw new BadRequestException(
            "Acknowledge the unresolved work before closing this case.",
          );
        }
        row.status = "closed";
        return;
      }
      if (dto.action === "reopen") {
        if (!owner)
          throw new ForbiddenException(
            "Only an owner can reopen this request.",
          );
        row.status = "under_review";
        return;
      }
      throw new ForbiddenException(
        "This action is not available while the request is responded.",
      );
    }
    if (row.status === "requested") {
      if (dto.action !== "begin_review") {
        throw new ForbiddenException(
          "A requested case can only move to review.",
        );
      }
      row.status = "under_review";
      return;
    }

    // under_review / blocked
    if (dto.action === "begin_review") {
      row.status = "under_review";
      return;
    }
    if (dto.action === "respond") {
      if (!owner)
        throw new ForbiddenException("Only an owner can record a response.");
      if (!dto.response)
        throw new BadRequestException("A response is required.");
      const unresolved = await this.unresolvedCount(tenantId, row.id);
      await manager.save(
        manager.create(RightsResponseEntity, {
          requestId: row.id,
          tenantId,
          language: dto.response.language,
          text: dto.response.text,
          resolution: dto.response.resolution,
          unresolvedCount: unresolved,
          requestVersion: row.version,
        }),
      );
      row.status = "responded";
      return;
    }
    const itemActions = [
      "declare_item",
      "verify_item",
      "block_item",
      "retain_item",
      "retry_item",
    ];
    if (itemActions.includes(dto.action)) {
      if (!dto.workItemId)
        throw new BadRequestException(
          "A work item must be chosen for this action.",
        );
      const item = await manager.findOne(RightsWorkItemEntity, {
        where: { id: dto.workItemId, requestId: row.id, tenantId },
      });
      if (!item) throw new NotFoundException("Work item not found.");
      if (item.location.mapping === "unknown" && dto.action !== "retry_item") {
        throw new ForbiddenException("This location is unmapped.");
      }
      if (
        (dto.action === "verify_item" || dto.action === "retain_item") &&
        !owner
      ) {
        throw new ForbiddenException("Only an owner can take this action.");
      }
      item.status =
        dto.action === "declare_item"
          ? "declared"
          : dto.action === "verify_item"
            ? "independently_reviewed"
            : dto.action === "block_item"
              ? "blocked"
              : dto.action === "retain_item"
                ? "retained"
                : "pending";
      if (dto.action === "declare_item" || dto.action === "retain_item") {
        item.declaredBy = membership.userId;
        item.declaredEvidence = dto.evidenceRefs;
      }
      item.version += 1;
      await manager.save(item);
      const items = await manager.find(RightsWorkItemEntity, {
        where: { requestId: row.id },
      });
      row.status = items.every((candidate) =>
        ["blocked", "retained"].includes(candidate.status),
      )
        ? "blocked"
        : "under_review";
      return;
    }
    throw new BadRequestException(
      `Unsupported action for this request state: ${dto.action}`,
    );
  }

  private async unresolvedCount(
    tenantId: string,
    requestId: string,
  ): Promise<number> {
    const items = await this.workItems.find({ where: { tenantId, requestId } });
    return items.filter(
      (item) => !["independently_reviewed", "retained"].includes(item.status),
    ).length;
  }

  private async resolveAssignee(tenantId: string, userId: string) {
    const membership = await this.memberships.findOne({
      where: { tenantId, userId },
    });
    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "staff")
    )
      return null;
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    return { id: user.id, displayName: user.displayName };
  }

  private async appendAudit(
    manager: import("typeorm").EntityManager,
    requestId: string,
    tenantId: string,
    version: number,
    action: RightsAction | "submitted",
    note: string,
    actorId: string,
    evidenceRefs: string[],
  ): Promise<void> {
    const previous = await manager.findOne(RightsAuditEventEntity, {
      where: { requestId },
      order: { version: "DESC" },
    });
    await manager.save(
      manager.create(RightsAuditEventEntity, {
        requestId,
        tenantId,
        version,
        action,
        note,
        actorId,
        evidenceRefs,
        previousHash: previous?.eventHash ?? null,
        eventHash: createHash("sha256")
          .update(
            `${previous?.eventHash ?? ""}:${requestId}:${version}:${action}`,
          )
          .digest("hex"),
      }),
    );
  }

  private async findOrThrow(
    tenantId: string,
    id: string,
    manager?: import("typeorm").EntityManager,
  ): Promise<RightsRequestEntity> {
    const repo = manager
      ? manager.getRepository(RightsRequestEntity)
      : this.requests;
    const row = await repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Rights request not found.");
    return row;
  }

  private async detailView(row: RightsRequestEntity): Promise<RightsDetail> {
    const items = await this.workItems.find({
      where: { requestId: row.id },
      order: { id: "ASC" },
    });
    const responses = await this.responses.find({
      where: { requestId: row.id },
      order: { at: "ASC" },
    });
    const history = await this.auditEvents.find({
      where: { requestId: row.id },
      order: { version: "ASC" },
    });
    return {
      id: row.id,
      sessionId: row.sessionId,
      syntheticReference: row.syntheticReference,
      kind: row.kind,
      inputLanguage: row.inputLanguage,
      details: row.details,
      correction: row.correction ?? undefined,
      source: row.source,
      status: row.status,
      version: row.version,
      assignee: row.assignee,
      workItems: items.map((item) => ({
        id: item.id,
        version: item.version,
        location: item.location,
        status: item.status,
        declaredBy: item.declaredBy,
        declaredEvidence: item.declaredEvidence,
        relatedFollowupTaskId: item.relatedFollowupTaskId,
      })),
      responses: responses.map((response) => ({
        id: response.id,
        at: response.at.toISOString(),
        language: response.language,
        text: response.text,
        resolution: response.resolution,
        unresolvedCount: response.unresolvedCount,
        requestVersion: response.requestVersion,
      })),
      submittedAt: row.submittedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      mode: row.mode,
      assurance: row.assurance,
      history: history.map((event) => ({
        version: event.version,
        action: event.action,
        note: event.note,
        actorId: event.actorId,
        at: event.at.toISOString(),
        evidenceRefs: event.evidenceRefs,
        previousHash: event.previousHash,
        eventHash: event.eventHash,
      })),
    };
  }

  private toRightsRequest(row: RightsRequestEntity): Promise<RightsRequest> {
    return this.detailView(row);
  }

  private async participantView(
    row: RightsRequestEntity,
  ): Promise<ParticipantRightsRequest> {
    const items = await this.workItems.find({ where: { requestId: row.id } });
    const responses = await this.responses.find({
      where: { requestId: row.id },
      order: { at: "ASC" },
    });
    const history = await this.auditEvents.find({
      where: { requestId: row.id },
      order: { version: "ASC" },
    });
    const progress = {
      pending: items.filter((item) => item.status === "pending").length,
      declared: items.filter((item) => item.status === "declared").length,
      reviewed: items.filter((item) => item.status === "independently_reviewed")
        .length,
      unknown: items.filter((item) => item.status === "unknown").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      retained: items.filter((item) => item.status === "retained").length,
    };
    return {
      id: row.id,
      kind: row.kind,
      inputLanguage: row.inputLanguage,
      details: row.details,
      correction: row.correction ?? undefined,
      source: {
        noticeId: row.source.noticeId,
        entryVersion: row.source.entryVersion,
        noticeLanguage: row.source.noticeLanguage,
        noticeTitle: row.source.noticeTitle,
      },
      status: row.status,
      version: row.version,
      responses: responses.map((response) => ({
        id: response.id,
        at: response.at.toISOString(),
        language: response.language,
        text: response.text,
        resolution: response.resolution,
        unresolvedCount: response.unresolvedCount,
        requestVersion: response.requestVersion,
      })),
      progress,
      history: history.map((event) => ({
        status: row.status,
        at: event.at.toISOString(),
        version: event.version,
      })),
      submittedAt: row.submittedAt.toISOString(),
      mode: row.mode,
      assurance: row.assurance,
    };
  }
}
