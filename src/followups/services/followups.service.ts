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
  FollowupAction,
  FollowupAssignee,
  FollowupDetail,
  FollowupTask,
} from "@sahmati/contracts";
import { FollowupTaskEntity } from "../entities/followup-task.entity";
import { FollowupEventEntity } from "../entities/followup-event.entity";
import { CreateFromReceiptDto } from "../dto/create-from-receipt.dto";
import { FollowupActionDto } from "../dto/followup-action.dto";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { ConsentSandboxService } from "../../consent-sandbox/services/consent-sandbox.service";
import { NoticesService } from "../../notices/services/notices.service";
import { RegisterService } from "../../register/services/register.service";
import { MembershipEntity } from "../../auth/entities/membership.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import type { CurrentMembership } from "../../common/guards/tenant-membership.guard";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";

@Injectable()
export class FollowupsService {
  constructor(
    @InjectRepository(FollowupTaskEntity)
    private readonly tasks: Repository<FollowupTaskEntity>,
    @InjectRepository(FollowupEventEntity)
    private readonly events: Repository<FollowupEventEntity>,
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

  async list(tenantId: string): Promise<FollowupTask[]> {
    const rows = await this.tasks.find({
      where: { tenantId },
      order: { updatedAt: "DESC" },
    });
    return rows.map((row) => this.toView(row));
  }

  async assignees(tenantId: string): Promise<FollowupAssignee[]> {
    const rows = await this.memberships.find({
      where: { tenantId },
    });
    const staffOrOwner = rows.filter(
      (row) => row.role === "owner" || row.role === "staff",
    );
    const users = await this.users.findBy({});
    const byId = new Map(users.map((user) => [user.id, user]));
    return staffOrOwner
      .map((row) => {
        const user = byId.get(row.userId);
        return user
          ? { id: user.id, displayName: user.displayName, role: row.role }
          : null;
      })
      .filter((value): value is FollowupAssignee => value !== null);
  }

  async get(tenantId: string, id: string): Promise<FollowupDetail> {
    const task = await this.findOrThrow(tenantId, id);
    const events = await this.events.find({
      where: { taskId: id },
      order: { version: "ASC" },
    });
    return {
      ...this.toView(task),
      history: events.map((event) => ({
        version: event.version,
        action: event.action,
        actorId: event.actorId,
        occurredAt: event.occurredAt.toISOString(),
        note: event.note,
        evidenceRefs: event.evidenceRefs,
        previousHash: event.previousHash,
        eventHash: event.eventHash,
        task: event.task,
      })),
    };
  }

  async createFromReceipt(
    tenantId: string,
    dto: CreateFromReceiptDto,
    membership: CurrentMembership,
  ): Promise<FollowupTask[]> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(
        manager,
        tenantId,
        dto.idempotencyKey,
        async () => {
          const receipts = await this.consent.ledger(tenantId);
          const receipt = receipts.find((row) => row.id === dto.receiptId);
          if (!receipt)
            throw new NotFoundException("Withdrawal receipt not found.");
          if (receipt.kind !== "choices_withdrawn") {
            throw new BadRequestException(
              "Follow-ups can only be created from a withdrawal receipt.",
            );
          }
          const existing = await manager.find(FollowupTaskEntity, {
            where: { tenantId, receiptId: receipt.id },
          });
          if (existing.length) return existing.map((row) => this.toView(row));

          const notice = await this.notices.get(
            tenantId,
            receipt.offer.notice.id,
          );
          const entries = await this.register.list(tenantId);
          const entry = entries.find((row) => row.id === notice.entryId);
          const declaredLocations = [
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
          const purposeIds = receipt.choices.map((choice) => choice.purposeId);
          const createdTasks: FollowupTaskEntity[] = [];

          const sourceLocations =
            declaredLocations.length > 0
              ? declaredLocations
              : [
                  {
                    kind: "unmapped" as const,
                    name: "other",
                    detail: "No declared location on record.",
                  },
                ];

          for (const location of sourceLocations) {
            const key = createHash("sha256")
              .update(`${receipt.id}:${location.kind}:${location.name}`)
              .digest("hex");
            const task = manager.create(FollowupTaskEntity, {
              tenantId,
              receiptId: receipt.id,
              receiptHash: receipt.receiptHash,
              sessionId: receipt.sessionId,
              noticeId: notice.id,
              entryVersion: notice.entryVersion,
              withdrawnPurposeIds: purposeIds,
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
              version: 1,
              responsibleRole: "owner" as const,
              assignee: null,
              declaredBy: null,
              declaredEvidence: [],
              retentionNote: entry?.retentionNote ?? "Unreviewed.",
              mappingResolution: null,
              mappedTaskIds: null,
            });
            await manager.save(task);
            await manager.save(
              manager.create(FollowupEventEntity, {
                taskId: task.id,
                tenantId,
                version: 1,
                action: "created",
                actorId: membership.userId,
                note: "Follow-up created from withdrawal receipt.",
                evidenceRefs: [],
                previousHash: null,
                eventHash: createHash("sha256")
                  .update(`created:${task.id}`)
                  .digest("hex"),
                task: this.toView(task),
              }),
            );
            await this.evidence.append(manager, {
              tenantId,
              kind: "followup",
              sourceId: task.id,
              version: task.version,
              action: "created",
              status: task.status,
              provenance: "recorded",
              actorId: membership.userId,
            });
            createdTasks.push(task);
          }
          return createdTasks.map((row) => this.toView(row));
        },
      );
    });
  }

  async act(
    tenantId: string,
    id: string,
    dto: FollowupActionDto,
    membership: CurrentMembership,
  ): Promise<FollowupTask> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(
        manager,
        tenantId,
        dto.idempotencyKey,
        async () => {
          const task = await manager.findOne(FollowupTaskEntity, {
            where: { id, tenantId },
          });
          if (!task) throw new NotFoundException("Follow-up task not found.");
          if (task.version !== dto.version) {
            throw new ConflictException(
              "This task changed since you last loaded it.",
            );
          }
          const targetAssignee = dto.assigneeId
            ? await this.resolveAssignee(tenantId, dto.assigneeId)
            : null;
          this.applyAction(
            task,
            dto.action,
            membership,
            dto.evidenceRefs,
            targetAssignee,
          );
          task.version += 1;
          await manager.save(task);

          const previous = await manager.findOne(FollowupEventEntity, {
            where: { taskId: id },
            order: { version: "DESC" },
          });
          await manager.save(
            manager.create(FollowupEventEntity, {
              taskId: id,
              tenantId,
              version: task.version,
              action: dto.action,
              actorId: membership.userId,
              note: dto.note,
              evidenceRefs: dto.evidenceRefs,
              previousHash: previous?.eventHash ?? null,
              eventHash: createHash("sha256")
                .update(
                  `${previous?.eventHash ?? ""}:${id}:${task.version}:${dto.action}`,
                )
                .digest("hex"),
              task: this.toView(task),
            }),
          );
          await this.evidence.append(manager, {
            tenantId,
            kind: "followup",
            sourceId: task.id,
            version: task.version,
            action: dto.action,
            status: task.status,
            provenance: "recorded",
            actorId: membership.userId,
            note: dto.note,
            evidenceRefs: dto.evidenceRefs,
          });
          return this.toView(task);
        },
      );
    });
  }

  private async resolveAssignee(
    tenantId: string,
    userId: string,
  ): Promise<FollowupAssignee | null> {
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
    return {
      id: user.id,
      displayName: user.displayName,
      role: membership.role,
    };
  }

  private applyAction(
    task: FollowupTaskEntity,
    action: FollowupAction,
    membership: CurrentMembership,
    evidenceRefs: string[],
    targetAssignee: FollowupAssignee | null,
  ): void {
    const owner = membership.role === "owner";
    if (action === "assign") {
      if (!owner)
        throw new ForbiddenException("Only an owner can assign this task.");
      task.assignee = targetAssignee;
      return;
    }
    if (task.status === "independently_reviewed") {
      if (action === "reopen" && owner) {
        task.status = "pending";
        return;
      }
      throw new ForbiddenException(
        "This task is independently reviewed; only an owner may reopen it.",
      );
    }
    if (action === "block") {
      task.status = "blocked";
      return;
    }
    if (action === "retry") {
      if (
        ![
          "blocked",
          "request_recorded",
          "completion_declared",
          "retention_exception_declared",
        ].includes(task.status)
      ) {
        throw new ForbiddenException(
          "This task cannot be retried from its current state.",
        );
      }
      if (task.status === "retention_exception_declared" && !owner) {
        throw new ForbiddenException(
          "Only an owner can retry a declared retention exception.",
        );
      }
      task.status = "pending";
      return;
    }
    if (task.location.mapping === "unknown") {
      throw new ForbiddenException(
        "This location is unmapped; map it before declaring an outcome.",
      );
    }
    if (action === "record_request") {
      if (!["pending", "request_recorded"].includes(task.status)) {
        throw new ForbiddenException(
          "A request can only be recorded while pending.",
        );
      }
      task.status = "request_recorded";
      task.declaredBy = membership.userId;
      task.declaredEvidence = evidenceRefs;
      return;
    }
    if (action === "declare_complete") {
      if (
        !["pending", "request_recorded", "completion_declared"].includes(
          task.status,
        )
      ) {
        throw new ForbiddenException(
          "Completion can only be declared from an open state.",
        );
      }
      task.status = "completion_declared";
      task.declaredBy = membership.userId;
      task.declaredEvidence = evidenceRefs;
      return;
    }
    if (action === "retain") {
      if (!owner)
        throw new ForbiddenException(
          "Only an owner can declare a retention exception.",
        );
      task.status = "retention_exception_declared";
      task.declaredBy = membership.userId;
      task.declaredEvidence = evidenceRefs;
      return;
    }
    if (action === "verify") {
      if (!owner)
        throw new ForbiddenException(
          "Only an owner can record independent review.",
        );
      if (task.status !== "completion_declared") {
        throw new ForbiddenException(
          "Only a declared-complete task can be independently reviewed.",
        );
      }
      task.status = "independently_reviewed";
      return;
    }
  }

  private async findOrThrow(
    tenantId: string,
    id: string,
  ): Promise<FollowupTaskEntity> {
    const row = await this.tasks.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Follow-up task not found.");
    return row;
  }

  private toView(row: FollowupTaskEntity): FollowupTask {
    return {
      id: row.id,
      receiptId: row.receiptId,
      receiptHash: row.receiptHash,
      sessionId: row.sessionId,
      noticeId: row.noticeId,
      entryVersion: row.entryVersion,
      withdrawnPurposeIds: row.withdrawnPurposeIds,
      location: row.location,
      status: row.status,
      version: row.version,
      responsibleRole: row.responsibleRole,
      assignee: row.assignee,
      declaredBy: row.declaredBy,
      declaredEvidence: row.declaredEvidence,
      retentionNote: row.retentionNote,
      updatedAt: row.updatedAt.toISOString(),
      mode: row.mode,
      applicability: row.applicability,
      mappingResolution: row.mappingResolution,
      mappedTaskIds: row.mappedTaskIds,
    };
  }
}
