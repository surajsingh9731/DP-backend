import { Injectable } from '@nestjs/common';
import type { FollowupTask, FollowupEvent, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { FollowupsRepository } from './followups.repository.js';
import { followupDigest } from './followup-locations.js';
@Injectable()
export class FollowupHistoryService {
  constructor(private readonly repository: FollowupsRepository) {}
  async append(
    client: DatabaseClient,
    scope: TenantScope,
    task: FollowupTask,
    action: FollowupEvent['action'],
    note: string,
    evidenceRefs: string[],
    previousHash: string | null,
  ): Promise<void> {
    const content: Omit<FollowupEvent, 'eventHash'> = {
      version: task.version,
      action,
      actorId: scope.userId,
      occurredAt: task.updatedAt,
      note,
      evidenceRefs,
      previousHash,
      task,
    };
    await this.repository.append(client, scope, { ...content, eventHash: followupDigest(content) });
  }
}
