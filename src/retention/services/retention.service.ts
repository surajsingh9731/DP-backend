import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  RetentionActionView,
  RetentionHoldView,
  RetentionPreviewItemView,
} from "@sahmati/contracts";
import { RegisterEntryEntity } from "../../register/entities/register-entry.entity";
import { RetentionHoldEntity } from "../entities/retention-hold.entity";
import { RetentionActionEntity } from "../entities/retention-action.entity";
import { PlaceHoldDto } from "../dto/place-hold.dto";
import { ReleaseHoldDto } from "../dto/release-hold.dto";
import { ExecuteErasureDto } from "../dto/execute-erasure.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { IdempotencyService } from "../../common/services/idempotency.service";
import { EvidenceLedgerService } from "../../common/services/evidence-ledger.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class RetentionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly idempotency: IdempotencyService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * What's due for erasure right now: every register entry past its own
   * retention window, with no active hold and no erasure already recorded
   * against it. Computed on demand rather than stored — a cached "preview"
   * row would go stale the moment the clock ticks past a dueAt, so there's
   * nothing to persist that wouldn't immediately lie. Deliberately not
   * filtered by the register entry's own draft/published status — that
   * column tracks whether the *entry itself* is finalised, not whether its
   * data is actually being processed, and retention applies either way.
   */
  async preview(): Promise<RetentionPreviewItemView[]> {
    const tenantId = this.tenantId();
    const entries = await this.tenantContext
      .repo(RegisterEntryEntity)
      .find({ where: { tenantId } });
    if (entries.length === 0) return [];

    const activeHolds = await this.tenantContext
      .repo(RetentionHoldEntity)
      .find({ where: { tenantId, status: "active" } });
    const heldEntryIds = new Set(
      activeHolds.map((hold) => hold.registerEntryId),
    );
    const erasedEntryIds = new Set(
      (
        await this.tenantContext
          .repo(RetentionActionEntity)
          .find({ where: { tenantId } })
      ).map((a) => a.registerEntryId),
    );

    const now = Date.now();
    return entries
      .filter((entry) => !erasedEntryIds.has(entry.id))
      .map((entry) => {
        const dueAt = new Date(
          entry.createdAt.getTime() + entry.retentionDays * MS_PER_DAY,
        );
        const onHold = heldEntryIds.has(entry.id);
        return {
          registerEntryId: entry.id,
          purposeEn: entry.purposeEn,
          categoryCode: entry.categoryCode,
          dueAt: dueAt.toISOString(),
          overdue: !onHold && now > dueAt.getTime(),
          onHold,
        };
      });
  }

  async listHolds(): Promise<RetentionHoldView[]> {
    const tenantId = this.tenantId();
    const rows = await this.tenantContext
      .repo(RetentionHoldEntity)
      .find({ where: { tenantId }, order: { placedAt: "DESC" } });
    return rows.map((row) => this.toHoldView(row));
  }

  async placeHold(
    dto: PlaceHoldDto,
    session: AuthenticatedSession,
  ): Promise<RetentionHoldView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        await this.registerEntryOrThrow(dto.registerEntryId);
        const row = await manager.save(
          manager.create(RetentionHoldEntity, {
            tenantId,
            registerEntryId: dto.registerEntryId,
            reason: dto.reason,
            status: "active",
            placedByUserId: session.userId,
          }),
        );
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "retention_hold",
          sourceId: row.id,
          action: "placed",
          status: row.status,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toHoldView(row);
      },
    );
  }

  async releaseHold(
    id: string,
    dto: ReleaseHoldDto,
    session: AuthenticatedSession,
  ): Promise<RetentionHoldView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const row = await manager
          .getRepository(RetentionHoldEntity)
          .findOne({ where: { id, tenantId } });
        if (!row) throw new NotFoundException("Retention hold not found.");
        if (row.status === "released")
          throw new BadRequestException("This hold is already released.");
        row.status = "released";
        row.releasedByUserId = session.userId;
        row.releasedAt = new Date();
        await manager.save(row);
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "retention_hold",
          sourceId: row.id,
          action: "released",
          status: row.status,
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toHoldView(row);
      },
    );
  }

  async executeErasure(
    dto: ExecuteErasureDto,
    session: AuthenticatedSession,
  ): Promise<RetentionActionView> {
    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();

    return this.idempotency.runOnce(
      manager,
      tenantId,
      dto.idempotencyKey,
      async () => {
        const entry = await this.registerEntryOrThrow(dto.registerEntryId);
        const activeHold = await manager
          .getRepository(RetentionHoldEntity)
          .findOne({
            where: { tenantId, registerEntryId: entry.id, status: "active" },
          });
        if (activeHold) {
          throw new BadRequestException(
            "This register entry has an active retention hold and cannot be erased.",
          );
        }
        const dueAt = new Date(
          entry.createdAt.getTime() + entry.retentionDays * MS_PER_DAY,
        );
        if (Date.now() < dueAt.getTime()) {
          throw new BadRequestException(
            "This register entry has not yet reached its retention window.",
          );
        }

        const row = await manager.save(
          manager.create(RetentionActionEntity, {
            tenantId,
            registerEntryId: entry.id,
            notes: dto.notes,
            executedByUserId: session.userId,
          }),
        );
        await this.evidenceLedger.append(manager, {
          tenantId,
          kind: "retention_action",
          sourceId: row.id,
          action: "erasure_executed",
          status: "executed",
          actorId: session.userId,
          provenance: "declared",
        });
        return this.toActionView(row);
      },
    );
  }

  private async registerEntryOrThrow(id: string): Promise<RegisterEntryEntity> {
    const row = await this.tenantContext
      .repo(RegisterEntryEntity)
      .findOne({ where: { id, tenantId: this.tenantId() } });
    if (!row) throw new NotFoundException("Register entry not found.");
    return row;
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }

  private toHoldView(row: RetentionHoldEntity): RetentionHoldView {
    return {
      id: row.id,
      registerEntryId: row.registerEntryId,
      reason: row.reason,
      status: row.status,
      placedAt: row.placedAt.toISOString(),
      releasedAt: row.releasedAt?.toISOString() ?? null,
    };
  }

  private toActionView(row: RetentionActionEntity): RetentionActionView {
    return {
      id: row.id,
      registerEntryId: row.registerEntryId,
      notes: row.notes,
      executedAt: row.executedAt.toISOString(),
    };
  }
}
