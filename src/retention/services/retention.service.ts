import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import type {
  RetentionContextView,
  RetentionHold,
  RetentionPage,
  RetentionPolicy,
  RetentionPreviewItem,
  RetentionPreviewPage,
  RetentionRecordDetail,
} from '@sahmati/contracts';
import { RetentionPolicyEntity } from '../entities/retention-policy.entity';
import { RetentionHoldEntity } from '../entities/retention-hold.entity';
import { RetentionHistoryEntity } from '../entities/retention-history.entity';
import { RetentionPreviewEntity } from '../entities/retention-preview.entity';
import { CreateRetentionPolicyDto, EditRetentionPolicyDto, RetentionPolicyActionDto } from '../dto/retention-policy.dto';
import { CreateRetentionHoldDto, ReleaseRetentionHoldDto } from '../dto/retention-hold.dto';
import { CreatePreviewDto } from '../dto/create-preview.dto';
import { RegisterService } from '../../register/services/register.service';
import { ConsentSandboxService } from '../../consent-sandbox/services/consent-sandbox.service';
import { NoticesService } from '../../notices/services/notices.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import type { CurrentMembership } from '../../common/guards/tenant-membership.guard';

const PAGE_SIZE = 20;

/** Mirrors the frontend's local RetentionSavedPreview shape (not part of @sahmati/contracts). */
export interface RetentionSavedPreview {
  id: string;
  entryId: string;
  asOf: string;
  createdAt: string;
  contentHash: string;
}

@Injectable()
export class RetentionService {
  constructor(
    @InjectRepository(RetentionPolicyEntity) private readonly policies: Repository<RetentionPolicyEntity>,
    @InjectRepository(RetentionHoldEntity) private readonly holds: Repository<RetentionHoldEntity>,
    @InjectRepository(RetentionHistoryEntity) private readonly history: Repository<RetentionHistoryEntity>,
    @InjectRepository(RetentionPreviewEntity) private readonly previews: Repository<RetentionPreviewEntity>,
    private readonly dataSource: DataSource,
    private readonly idempotency: IdempotencyService,
    private readonly register: RegisterService,
    private readonly consent: ConsentSandboxService,
    private readonly notices: NoticesService,
  ) {}

  // -- Listing / context ---------------------------------------------------

  async policiesPage(tenantId: string, entryId: string, after?: string): Promise<RetentionPage<RetentionPolicy>> {
    const rows = await this.pageQuery(this.policies, tenantId, entryId, after);
    return { items: rows.items.map((row) => this.policyView(row)), nextAfter: rows.nextAfter };
  }

  async holdsPage(tenantId: string, entryId: string, after?: string): Promise<RetentionPage<RetentionHold>> {
    const rows = await this.pageQuery(this.holds, tenantId, entryId, after);
    return { items: rows.items.map((row) => this.holdView(row)), nextAfter: rows.nextAfter };
  }

  async previewsPage(
    tenantId: string,
    entryId: string,
    after?: string,
  ): Promise<RetentionPage<RetentionSavedPreview>> {
    const rows = await this.pageQuery(this.previews, tenantId, entryId, after);
    return {
      items: rows.items.map((row) => ({
        id: row.id,
        entryId: row.entryId,
        asOf: row.asOf.toISOString(),
        createdAt: row.checkedAt.toISOString(),
        contentHash: row.contentHash,
      })),
      nextAfter: rows.nextAfter,
    };
  }

  async policyDetail(tenantId: string, id: string): Promise<RetentionRecordDetail<RetentionPolicy>> {
    const row = await this.findOrThrow(this.policies, tenantId, id, 'Retention policy');
    const events = await this.history.find({
      where: { tenantId, recordType: 'policy', recordId: id },
      order: { version: 'ASC' },
    });
    return { record: this.policyView(row), history: this.historyView(events) };
  }

  async holdDetail(tenantId: string, id: string): Promise<RetentionRecordDetail<RetentionHold>> {
    const row = await this.findOrThrow(this.holds, tenantId, id, 'Retention hold');
    const events = await this.history.find({
      where: { tenantId, recordType: 'hold', recordId: id },
      order: { version: 'ASC' },
    });
    return { record: this.holdView(row), history: this.historyView(events) };
  }

  async context(tenantId: string, entryId: string): Promise<RetentionContextView> {
    const entries = await this.register.list(tenantId);
    const entry = entries.find((row) => row.id === entryId);
    if (!entry) throw new NotFoundException('Register entry not found.');
    const locations = [
      ...(entry.vendorReferences ?? []).map((ref) => ({
        key: createHash('sha256').update(`vendor:${ref.name}`).digest('hex'),
        name: ref.name,
      })),
      ...(entry.storageReferences ?? []).map((ref) => ({
        key: createHash('sha256').update(`storage:${ref.name}`).digest('hex'),
        name: ref.name,
      })),
    ];
    const sampleRecords = await this.sampleRecordsFor(tenantId, entryId);
    return { entryId, entryVersion: entry.version, locations, sampleRecords: sampleRecords.map((r) => ({ id: r.id })) };
  }

  // -- Policy lifecycle -----------------------------------------------------

  async createPolicy(
    tenantId: string,
    dto: CreateRetentionPolicyDto,
    membership: CurrentMembership,
  ): Promise<RetentionPolicy> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const row = await manager.save(
          manager.create(RetentionPolicyEntity, {
            tenantId,
            entryId: dto.entryId,
            entryVersion: dto.entryVersion,
            name: dto.name,
            durationDays: dto.durationDays,
            rationale: dto.rationale,
            status: 'draft',
            version: 1,
          }),
        );
        await this.appendHistory(manager, tenantId, 'policy', row.id, 1, 'created', dto.rationale, membership.userId);
        return this.policyView(row);
      });
    });
  }

  async editPolicy(
    tenantId: string,
    id: string,
    dto: EditRetentionPolicyDto,
    membership: CurrentMembership,
  ): Promise<RetentionPolicy> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const row = await manager.findOne(RetentionPolicyEntity, { where: { id, tenantId } });
        if (!row) throw new NotFoundException('Retention policy not found.');
        if (row.version !== dto.version) {
          throw new ConflictException('This policy changed since you last loaded it.');
        }
        row.entryVersion = dto.entryVersion;
        row.name = dto.name;
        row.durationDays = dto.durationDays;
        row.rationale = dto.rationale;
        row.status = 'draft';
        row.version += 1;
        await manager.save(row);
        await this.appendHistory(manager, tenantId, 'policy', id, row.version, 'edited', dto.rationale, membership.userId);
        return this.policyView(row);
      });
    });
  }

  async policyAction(
    tenantId: string,
    id: string,
    dto: RetentionPolicyActionDto,
    membership: CurrentMembership,
  ): Promise<RetentionPolicy> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const row = await manager.findOne(RetentionPolicyEntity, { where: { id, tenantId } });
        if (!row) throw new NotFoundException('Retention policy not found.');
        if (row.version !== dto.version) {
          throw new ConflictException('This policy changed since you last loaded it.');
        }
        if (dto.action === 'submit') {
          if (row.status !== 'draft') throw new BadRequestException('Only a draft can be submitted.');
          row.status = 'submitted';
        } else if (dto.action === 'review') {
          if (membership.role !== 'owner') throw new ForbiddenException('Only an owner can review a policy.');
          if (row.status !== 'submitted') throw new BadRequestException('Only a submitted policy can be reviewed.');
          if (!dto.internalReviewAcknowledged) {
            throw new BadRequestException('Acknowledge the internal-only review scope.');
          }
          row.status = 'internally_reviewed';
        } else {
          if (membership.role !== 'owner') throw new ForbiddenException('Only an owner can retire a policy.');
          if (row.status === 'retired') throw new BadRequestException('This policy is already retired.');
          row.status = 'retired';
        }
        row.version += 1;
        await manager.save(row);
        await this.appendHistory(manager, tenantId, 'policy', id, row.version, dto.action, dto.reason, membership.userId);
        return this.policyView(row);
      });
    });
  }

  // -- Holds -----------------------------------------------------------------

  async createHold(
    tenantId: string,
    dto: CreateRetentionHoldDto,
    membership: CurrentMembership,
  ): Promise<RetentionHold> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const row = await manager.save(
          manager.create(RetentionHoldEntity, {
            tenantId,
            entryId: dto.entryId,
            scope: dto.scope,
            target: dto.target ?? null,
            reason: dto.reason,
            status: 'active',
            version: 1,
          }),
        );
        await this.appendHistory(manager, tenantId, 'hold', row.id, 1, 'created', dto.reason, membership.userId);
        return this.holdView(row);
      });
    });
  }

  async releaseHold(
    tenantId: string,
    id: string,
    dto: ReleaseRetentionHoldDto,
    membership: CurrentMembership,
  ): Promise<RetentionHold> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const row = await manager.findOne(RetentionHoldEntity, { where: { id, tenantId } });
        if (!row) throw new NotFoundException('Retention hold not found.');
        if (row.version !== dto.version) {
          throw new ConflictException('This hold changed since you last loaded it.');
        }
        if (row.status === 'released') throw new BadRequestException('This hold is already released.');
        row.status = 'released';
        row.version += 1;
        await manager.save(row);
        await this.appendHistory(manager, tenantId, 'hold', id, row.version, 'released', dto.reason, membership.userId);
        return this.holdView(row);
      });
    });
  }

  // -- Dry-run previews --------------------------------------------------

  async createPreview(tenantId: string, dto: CreatePreviewDto): Promise<RetentionPreviewPage> {
    const entries = await this.register.list(tenantId);
    const entry = entries.find((row) => row.id === dto.entryId);
    if (!entry) throw new NotFoundException('Register entry not found.');

    const activeHolds = await this.holds.find({ where: { tenantId, entryId: dto.entryId, status: 'active' } });
    const activePolicy = await this.policies.findOne({
      where: { tenantId, entryId: dto.entryId, status: 'internally_reviewed' },
      order: { updatedAt: 'DESC' },
    });
    const locations = [
      ...(entry.vendorReferences ?? []).map((ref) => ({ kind: 'vendor', name: ref.name, detail: ref.service })),
      ...(entry.storageReferences ?? []).map((ref) => ({
        kind: ref.medium === 'paper' ? 'paper' : 'digital',
        name: ref.name,
        detail: ref.location,
      })),
    ];
    const sampleRecords = await this.sampleRecordsFor(tenantId, dto.entryId);
    const asOfMs = Date.parse(dto.asOf);
    if (Number.isNaN(asOfMs)) throw new BadRequestException('asOf must be a valid ISO-8601 instant.');

    const items: RetentionPreviewItem[] = [];
    for (const sample of sampleRecords) {
      for (const location of locations.length ? locations : [{ kind: 'unmapped', name: 'other', detail: '' }]) {
        const key = createHash('sha256')
          .update(`${sample.id}:${location.kind}:${location.name}`)
          .digest('hex');
        const activityHold = activeHolds.find((h) => h.scope === 'activity');
        const locationHold = activeHolds.find((h) => h.scope === 'location' && h.target === location.name);
        const recordHold = activeHolds.find((h) => h.scope === 'sample_record' && h.target === sample.id);
        if (activityHold || locationHold || recordHold) {
          items.push({
            key,
            sampleRecordId: sample.id,
            location: { key, kind: location.kind, name: location.name, detail: location.detail },
            outcome: 'held',
            reasons: ['active_hold'],
            referenceAt: sample.referenceAt,
            dueAt: null,
          });
          continue;
        }
        if (!activePolicy) {
          items.push({
            key,
            sampleRecordId: sample.id,
            location: { key, kind: location.kind, name: location.name, detail: location.detail },
            outcome: 'candidate_review',
            reasons: ['policy_unreviewed'],
            referenceAt: sample.referenceAt,
            dueAt: null,
          });
          continue;
        }
        if (location.kind === 'unmapped') {
          items.push({
            key,
            sampleRecordId: sample.id,
            location: { key, kind: location.kind, name: location.name, detail: location.detail },
            outcome: 'unknown',
            reasons: ['unknown_coverage'],
            referenceAt: sample.referenceAt,
            dueAt: null,
          });
          continue;
        }
        if (!sample.referenceAt) {
          items.push({
            key,
            sampleRecordId: sample.id,
            location: { key, kind: location.kind, name: location.name, detail: location.detail },
            outcome: 'unknown',
            reasons: ['missing_reference_time'],
            referenceAt: null,
            dueAt: null,
          });
          continue;
        }
        const dueAtMs = Date.parse(sample.referenceAt) + activePolicy.durationDays * 86_400_000;
        items.push({
          key,
          sampleRecordId: sample.id,
          location: { key, kind: location.kind, name: location.name, detail: location.detail },
          outcome: asOfMs >= dueAtMs ? 'candidate_review' : 'not_due',
          reasons: asOfMs >= dueAtMs ? ['retention_exception_review'] : [],
          referenceAt: sample.referenceAt,
          dueAt: new Date(dueAtMs).toISOString(),
        });
      }
    }

    const summary = {
      held: items.filter((i) => i.outcome === 'held').length,
      conflict: items.filter((i) => i.outcome === 'conflict').length,
      unknown: items.filter((i) => i.outcome === 'unknown').length,
      not_due: items.filter((i) => i.outcome === 'not_due').length,
      candidate_review: items.filter((i) => i.outcome === 'candidate_review').length,
    };
    const inputHash = createHash('sha256')
      .update(JSON.stringify({ entryVersion: entry.version, sampleRecords, locations }))
      .digest('hex');
    const contentHash = createHash('sha256').update(JSON.stringify(items)).digest('hex');

    const row = await this.previews.save(
      this.previews.create({
        tenantId,
        entryId: dto.entryId,
        asOf: new Date(asOfMs),
        entryVersion: entry.version,
        items,
        summary,
        freshness: 'matches_loaded_inputs',
        inputHash,
        contentHash,
        integrity: 'match',
      }),
    );
    return this.previewPage(row, undefined);
  }

  async preview(tenantId: string, id: string, cursor?: string): Promise<RetentionPreviewPage> {
    const row = await this.findOrThrow(this.previews, tenantId, id, 'Retention preview');
    return this.previewPage(row, cursor);
  }

  // -- Internal helpers -----------------------------------------------------

  private previewPage(row: RetentionPreviewEntity, cursor?: string): RetentionPreviewPage {
    const start = cursor ? (decodeCursor<{ index: number }>(cursor)?.index ?? 0) : 0;
    const page = row.items.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < row.items.length;
    return {
      id: row.id,
      entryId: row.entryId,
      asOf: row.asOf.toISOString(),
      checkedAt: row.checkedAt.toISOString(),
      items: page,
      summary: row.summary,
      nextCursor: hasMore ? encodeCursor({ index: start + PAGE_SIZE }) : null,
      freshness: row.freshness,
      sourceVersions: { entry: row.entryVersion },
      inputHash: row.inputHash,
      contentHash: row.contentHash,
      integrity: row.integrity,
    };
  }

  private async sampleRecordsFor(
    tenantId: string,
    entryId: string,
  ): Promise<{ id: string; referenceAt: string | null }[]> {
    const notices = await this.notices.list(tenantId);
    const noticeIds = new Set(notices.filter((n) => n.entryId === entryId).map((n) => n.id));
    const receipts = await this.consent.ledger(tenantId);
    return receipts
      .filter((r) => noticeIds.has(r.offer.notice.id) && r.kind === 'choices_recorded')
      .map((r) => ({ id: r.id, referenceAt: r.occurredAt }));
  }

  private async appendHistory(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    recordType: 'policy' | 'hold',
    recordId: string,
    version: number,
    action: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await manager.save(
      manager.create(RetentionHistoryEntity, { tenantId, recordType, recordId, version, action, reason, actorId }),
    );
  }

  private async pageQuery<T extends { id: string; tenantId: string; entryId: string; version?: number }>(
    repo: Repository<T>,
    tenantId: string,
    entryId: string,
    after?: string,
  ): Promise<{ items: T[]; nextAfter: string | null }> {
    const query = repo
      .createQueryBuilder('row')
      .where('row.tenantId = :tenantId', { tenantId })
      .andWhere('row.entryId = :entryId', { entryId })
      .orderBy('row.id', 'ASC')
      .take(PAGE_SIZE + 1);
    if (after) query.andWhere('row.id > :after', { after });
    const rows = await query.getMany();
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    return { items, nextAfter: hasMore ? items[items.length - 1]!.id : null };
  }

  private async findOrThrow<T extends { id: string; tenantId: string }>(
    repo: Repository<T>,
    tenantId: string,
    id: string,
    label: string,
  ): Promise<T> {
    const row = await repo.findOne({ where: { id, tenantId } as never });
    if (!row) throw new NotFoundException(`${label} not found.`);
    return row;
  }

  private historyView(events: RetentionHistoryEntity[]) {
    return events.map((event) => ({
      version: event.version,
      action: event.action,
      at: event.at.toISOString(),
      reason: event.reason,
      actorId: event.actorId,
    }));
  }

  private policyView(row: RetentionPolicyEntity): RetentionPolicy {
    return {
      id: row.id,
      entryId: row.entryId,
      entryVersion: row.entryVersion,
      name: row.name,
      durationDays: row.durationDays,
      rationale: row.rationale,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private holdView(row: RetentionHoldEntity): RetentionHold {
    return {
      id: row.id,
      entryId: row.entryId,
      scope: row.scope,
      target: row.target,
      reason: row.reason,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
