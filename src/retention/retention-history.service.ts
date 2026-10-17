import { Injectable } from '@nestjs/common';
import type {
  RetentionPolicy,
  RetentionHold,
  TenantScope,
  RetentionEvent,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RetentionRepository, type RetentionRecordKind } from './retention.repository.js';
import { followupDigest } from '../followups/followup-locations.js';
@Injectable()
export class RetentionHistoryService {
  constructor(private readonly repository: RetentionRepository) {}
  async append(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    record: RetentionPolicy | RetentionHold,
    action: string,
    reason: string,
  ) {
    const prior = (await this.repository.history(client, scope, kind, record.id))[0]?.data;
    const content: Omit<RetentionEvent<RetentionPolicy | RetentionHold>, 'eventHash'> = {
      record,
      version: record.version,
      action,
      reason,
      actorId: scope.userId,
      at: record.updatedAt,
      previousHash: prior?.eventHash ?? null,
    };
    await this.repository.append(client, scope, kind, {
      ...content,
      eventHash: followupDigest(content),
    });
  }
}
