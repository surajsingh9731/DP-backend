import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CheckDetail,
  CheckEvaluation,
  TaskEvidenceReview,
  TenantScope,
} from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { FollowupsRepository } from '../followups/followups.repository.js';
import { ChecksRepository } from './checks.repository.js';
import { LocalChecksService } from './local-checks.service.js';
import { reviewFreshness, assertCheckVersions, assertReviewDecision } from './checks.policy.js';
import { followupDigest } from '../followups/followup-locations.js';
import { EvaluateChecksDto, ReviewEvidenceDto } from './dto/checks.dto.js';
@Injectable()
export class ChecksService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly tasks: FollowupsRepository,
    private readonly repository: ChecksRepository,
    private readonly local: LocalChecksService,
  ) {}
  detail(scope: TenantScope, id: string): Promise<CheckDetail> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const task = (await this.tasks.task(client, scope, id, true)).data;
      const reviews = (await this.repository.reviews(client, scope, id)).map((row) => row.data),
        evaluations = (await this.repository.evaluations(client, scope, id)).map((row) => row.data),
        now = new Date();
      const freshness = reviewFreshness(task, reviews[0], now);
      return {
        task,
        reviews,
        evaluations,
        freshness,
        latestEvaluationCurrent:
          !!evaluations[0] &&
          evaluations[0].taskVersion === task.version &&
          evaluations[0].reviewVersion === (reviews[0]?.version ?? 0) &&
          evaluations[0].checks.find((check) => check.id === 'manual_assessment')?.freshness ===
            freshness,
        serverTime: now.toISOString(),
      };
    });
  }
  review(scope: TenantScope, id: string, dto: ReviewEvidenceDto): Promise<TaskEvidenceReview> {
    if (scope.role !== 'owner')
      throw new ForbiddenException('Only owners can review applicability and manual evidence.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'review',
        id,
        ...dto,
        evidenceRefs: [...dto.evidenceRefs].sort(),
        rationale: dto.rationale.trim(),
      });
      const task = (await this.tasks.task(client, scope, id, true)).data;
      if (command.response) return command.response as TaskEvidenceReview;
      const prior = (await this.repository.reviews(client, scope, id))[0]?.data;
      assertCheckVersions(task, prior, dto.taskVersion, dto.reviewVersion);
      assertReviewDecision(task, dto);
      const now = new Date();
      const data: TaskEvidenceReview = {
        id: randomUUID(),
        taskId: id,
        version: (prior?.version ?? 0) + 1,
        taskVersion: task.version,
        applicability: dto.applicability,
        result: dto.result,
        rationale: dto.rationale.trim(),
        evidenceRefs: [...dto.evidenceRefs].sort(),
        reviewerId: scope.userId,
        reviewedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + dto.validForMinutes * 60000).toISOString(),
        provenance: 'synthetic-manual-reference',
        authenticity: 'not-authenticated',
      };
      await this.repository.review(client, scope, data);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, data);
      return data;
    });
  }
  evaluate(scope: TenantScope, id: string, dto: EvaluateChecksDto): Promise<CheckEvaluation> {
    if (scope.role === 'viewer')
      throw new ForbiddenException('Read-only role cannot record an evaluation.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'evaluate',
        id,
        ...dto,
      });
      const task = (await this.tasks.task(client, scope, id, true)).data;
      if (command.response) return command.response as CheckEvaluation;
      const review = (await this.repository.reviews(client, scope, id))[0]?.data;
      assertCheckVersions(task, review, dto.taskVersion, dto.reviewVersion);
      const now = new Date();
      const content: Omit<CheckEvaluation, 'contentHash'> = {
        id: randomUUID(),
        taskId: id,
        taskVersion: task.version,
        reviewVersion: review?.version ?? 0,
        computedAt: now.toISOString(),
        computedBy: scope.userId,
        checks: await this.local.compute(client, scope, task, review, now),
        mode: 'local-sample',
      };
      const data = { ...content, contentHash: followupDigest(content) };
      await this.repository.evaluation(client, scope, data);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, data);
      return data;
    });
  }
}
