import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import type { CheckDetail, CheckEvaluation, CheckFreshness, MappingResult, TaskEvidenceReview } from '@sahmati/contracts';
import { CheckReviewEntity } from '../entities/check-review.entity';
import { CheckEvaluationEntity } from '../entities/check-evaluation.entity';
import { EvaluateChecksDto } from '../dto/evaluate-checks.dto';
import { ReviewEvidenceDto } from '../dto/review-evidence.dto';
import { ResolveLocationDto } from '../dto/resolve-location.dto';
import { FollowupTaskEntity } from '../../followups/entities/followup-task.entity';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { EvidenceLedgerService } from '../../common/services/evidence-ledger.service';
import type { CurrentMembership } from '../../common/guards/tenant-membership.guard';

@Injectable()
export class ChecksService {
  constructor(
    @InjectRepository(CheckReviewEntity) private readonly reviews: Repository<CheckReviewEntity>,
    @InjectRepository(CheckEvaluationEntity)
    private readonly evaluations: Repository<CheckEvaluationEntity>,
    @InjectRepository(FollowupTaskEntity) private readonly tasks: Repository<FollowupTaskEntity>,
    private readonly dataSource: DataSource,
    private readonly idempotency: IdempotencyService,
    private readonly evidence: EvidenceLedgerService,
  ) {}

  async get(tenantId: string, taskId: string): Promise<CheckDetail> {
    const task = await this.findTask(tenantId, taskId);
    const reviews = await this.reviews.find({ where: { taskId }, order: { version: 'DESC' } });
    const evaluations = await this.evaluations.find({ where: { taskId }, order: { computedAt: 'DESC' } });
    const latestReview = reviews[0] ?? null;
    const latestEvaluation = evaluations[0] ?? null;
    const freshness = this.freshnessFor(task, latestReview);
    return {
      task: this.taskView(task),
      reviews: reviews.map((row) => this.reviewView(row)),
      evaluations: evaluations.map((row) => this.evaluationView(row)),
      freshness,
      latestEvaluationCurrent:
        !!latestEvaluation &&
        latestEvaluation.taskVersion === task.version &&
        latestEvaluation.reviewVersion === (latestReview?.version ?? 0),
      serverTime: new Date().toISOString(),
    };
  }

  async evaluate(
    tenantId: string,
    taskId: string,
    dto: EvaluateChecksDto,
    membership: CurrentMembership,
  ): Promise<CheckEvaluation> {
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const task = await manager.findOne(FollowupTaskEntity, { where: { id: taskId, tenantId } });
        if (!task) throw new NotFoundException('Follow-up task not found.');
        if (task.version !== dto.taskVersion) {
          throw new ConflictException('The task changed since you last loaded it.');
        }
        const review = await manager.findOne(CheckReviewEntity, {
          where: { taskId },
          order: { version: 'DESC' },
        });
        if ((review?.version ?? 0) !== dto.reviewVersion) {
          throw new ConflictException('The latest review changed since you last loaded it.');
        }
        const freshness = this.freshnessFor(task, review ?? null);
        const checks = [
          {
            id: 'followup_state' as const,
            result: (['completion_declared', 'independently_reviewed'].includes(task.status)
              ? 'pass'
              : task.status === 'blocked'
                ? 'fail'
                : 'unknown') as 'pass' | 'fail' | 'unknown',
            reason: `followup_status_${task.status}`,
            provenance: 'local-record' as const,
            freshness: 'current' as const,
            references: [] as string[],
          },
          {
            id: 'location_reference' as const,
            result: (task.location.mapping === 'declared' ? 'pass' : 'unknown') as 'pass' | 'unknown',
            reason: task.location.mapping === 'declared' ? 'location_declared' : 'location_unmapped',
            provenance: 'local-record' as const,
            freshness: 'current' as const,
            references: [] as string[],
          },
          {
            id: 'manual_assessment' as const,
            result: review && freshness === 'current' ? review.result : 'unknown',
            reason: review ? 'manual_assessment_record' : 'manual_assessment_missing',
            provenance: 'synthetic-manual-reference' as const,
            freshness,
            references: review?.evidenceRefs ?? [],
          },
        ];
        const contentHash = createHash('sha256').update(JSON.stringify(checks)).digest('hex');
        const evaluation = await manager.save(
          manager.create(CheckEvaluationEntity, {
            taskId,
            tenantId,
            taskVersion: task.version,
            reviewVersion: review?.version ?? 0,
            computedBy: membership.userId,
            checks,
            contentHash,
            mode: 'local-sample',
          }),
        );
        await this.evidence.append(manager, {
          tenantId,
          kind: 'check_evaluation',
          sourceId: evaluation.id,
          version: evaluation.taskVersion,
          action: 'local_evaluation',
          status: freshness,
          provenance: 'computed',
          actorId: membership.userId,
        });
        return this.evaluationView(evaluation);
      });
    });
  }

  async review(
    tenantId: string,
    taskId: string,
    dto: ReviewEvidenceDto,
    membership: CurrentMembership,
  ): Promise<TaskEvidenceReview> {
    if (membership.role !== 'owner') throw new ForbiddenException('Only an owner can record a review.');
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const task = await manager.findOne(FollowupTaskEntity, { where: { id: taskId, tenantId } });
        if (!task) throw new NotFoundException('Follow-up task not found.');
        if (task.version !== dto.taskVersion) {
          throw new ConflictException('The task changed since you last loaded it.');
        }
        const latest = await manager.findOne(CheckReviewEntity, {
          where: { taskId },
          order: { version: 'DESC' },
        });
        if ((latest?.version ?? 0) !== dto.reviewVersion) {
          throw new ConflictException('The latest review changed since you last loaded it.');
        }
        const review = await manager.save(
          manager.create(CheckReviewEntity, {
            taskId,
            tenantId,
            version: (latest?.version ?? 0) + 1,
            taskVersion: task.version,
            applicability: dto.applicability,
            result: dto.result,
            rationale: dto.rationale,
            evidenceRefs: dto.evidenceRefs,
            reviewerId: membership.userId,
            validUntil: new Date(Date.now() + dto.validForMinutes * 60_000),
          }),
        );
        await this.evidence.append(manager, {
          tenantId,
          kind: 'check_review',
          sourceId: review.id,
          version: review.version,
          action: 'manual_review',
          status: review.result,
          provenance: 'manual',
          actorId: membership.userId,
          note: review.rationale,
          evidenceRefs: review.evidenceRefs,
        });
        return this.reviewView(review);
      });
    });
  }

  async mapLocation(
    tenantId: string,
    taskId: string,
    dto: ResolveLocationDto,
    membership: CurrentMembership,
  ): Promise<MappingResult> {
    if (membership.role !== 'owner') throw new ForbiddenException('Only an owner can resolve a mapping.');
    return this.dataSource.transaction(async (manager) => {
      return this.idempotency.runOnce(manager, tenantId, dto.idempotencyKey, async () => {
        const parent = await manager.findOne(FollowupTaskEntity, { where: { id: taskId, tenantId } });
        if (!parent) throw new NotFoundException('Follow-up task not found.');
        if (parent.version !== dto.taskVersion) {
          throw new ConflictException('The task changed since you last loaded it.');
        }
        if (parent.location.mapping !== 'unknown') {
          throw new BadRequestException('This task already has a declared location.');
        }
        const key = createHash('sha256')
          .update(`${parent.id}:${dto.kind}:${dto.name}:${Date.now()}`)
          .digest('hex');
        const child = await manager.save(
          manager.create(FollowupTaskEntity, {
            tenantId,
            receiptId: parent.receiptId,
            receiptHash: parent.receiptHash,
            sessionId: parent.sessionId,
            noticeId: parent.noticeId,
            entryVersion: parent.entryVersion,
            withdrawnPurposeIds: parent.withdrawnPurposeIds,
            location: { key, kind: dto.kind, name: dto.name, detail: dto.detail, mapping: 'declared' },
            status: 'pending',
            version: 1,
            responsibleRole: 'owner',
            assignee: null,
            declaredBy: null,
            declaredEvidence: [],
            retentionNote: parent.retentionNote,
            mappingResolution: { parentTaskId: parent.id },
            mappedTaskIds: null,
          }),
        );
        parent.mappedTaskIds = [...(parent.mappedTaskIds ?? []), child.id];
        parent.version += 1;
        await manager.save(parent);
        return { parent: this.taskView(parent), child: this.taskView(child) };
      });
    });
  }

  private freshnessFor(
    task: FollowupTaskEntity,
    review: CheckReviewEntity | null,
  ): CheckFreshness {
    if (!review) return 'missing';
    if (review.taskVersion !== task.version) return 'task_changed';
    if (review.validUntil.getTime() <= Date.now()) return 'stale';
    return 'current';
  }

  private async findTask(tenantId: string, id: string): Promise<FollowupTaskEntity> {
    const row = await this.tasks.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Follow-up task not found.');
    return row;
  }

  private taskView(row: FollowupTaskEntity) {
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

  private reviewView(row: CheckReviewEntity): TaskEvidenceReview {
    return {
      id: row.id,
      taskId: row.taskId,
      version: row.version,
      taskVersion: row.taskVersion,
      applicability: row.applicability,
      result: row.result,
      rationale: row.rationale,
      evidenceRefs: row.evidenceRefs,
      reviewerId: row.reviewerId,
      reviewedAt: row.reviewedAt.toISOString(),
      validUntil: row.validUntil.toISOString(),
      provenance: row.provenance,
      authenticity: row.authenticity,
    };
  }

  private evaluationView(row: CheckEvaluationEntity): CheckEvaluation {
    return {
      id: row.id,
      taskId: row.taskId,
      taskVersion: row.taskVersion,
      reviewVersion: row.reviewVersion,
      computedAt: row.computedAt.toISOString(),
      computedBy: row.computedBy,
      checks: row.checks,
      contentHash: row.contentHash,
      mode: row.mode,
    };
  }
}
