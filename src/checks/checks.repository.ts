import { ConflictException, Injectable } from '@nestjs/common';
import type {
  TenantScope,
  TaskEvidenceReview,
  CheckEvaluation,
  MappingResult,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { FollowupEventEntity } from '../followups/entities/followup-event.entity.js';
import { CheckReviewEntity, CheckEvaluationEntity, CheckCommandEntity } from './entities/index.js';
import { CHECK_LIMITS } from '../constants/checks.constants.js';
import { followupDigest } from '../followups/followup-locations.js';
@Injectable()
export class ChecksRepository {
  reviews(client: DatabaseClient, scope: TenantScope, taskId: string) {
    return client.manager.getRepository(CheckReviewEntity).find({
      where: { tenantId: scope.tenantId, taskId },
      order: { version: 'DESC' },
      take: CHECK_LIMITS.history,
    });
  }
  evaluations(client: DatabaseClient, scope: TenantScope, taskId: string) {
    return client.manager.getRepository(CheckEvaluationEntity).find({
      where: { tenantId: scope.tenantId, taskId },
      order: { computedAt: 'DESC', id: 'ASC' },
      take: CHECK_LIMITS.history,
    });
  }
  events(client: DatabaseClient, scope: TenantScope, taskId: string) {
    return client.manager.getRepository(FollowupEventEntity).find({
      where: { tenantId: scope.tenantId, taskId },
      order: { version: 'ASC' },
      take: CHECK_LIMITS.events + 1,
    });
  }
  review(client: DatabaseClient, scope: TenantScope, data: TaskEvidenceReview) {
    return client.manager
      .getRepository(CheckReviewEntity)
      .insert({ tenantId: scope.tenantId, taskId: data.taskId, version: data.version, data });
  }
  evaluation(client: DatabaseClient, scope: TenantScope, data: CheckEvaluation) {
    return client.manager.getRepository(CheckEvaluationEntity).insert({
      tenantId: scope.tenantId,
      id: data.id,
      taskId: data.taskId,
      computedAt: new Date(data.computedAt),
      data,
    });
  }
  async command(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:${scope.userId}:check-command:${key}`,
    ]);
    const hash = followupDigest(payload);
    const prior = await client.manager.getRepository(CheckCommandEntity).findOneBy({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
    });
    if (prior && prior.payloadHash !== hash)
      throw new ConflictException('Idempotency key has a different payload.');
    return { hash, response: prior?.response };
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    payloadHash: string,
    response: TaskEvidenceReview | CheckEvaluation | MappingResult,
  ) {
    return client.manager.getRepository(CheckCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
      payloadHash,
      response,
    });
  }
}
