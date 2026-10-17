import { Injectable } from '@nestjs/common';
import type { RightsRequest, RightsEvent, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RightsRepository } from './rights.repository.js';
import { followupDigest } from '../followups/followup-locations.js';
@Injectable()
export class RightsHistoryService {
  constructor(private readonly repository: RightsRepository) {}
  async append(
    client: DatabaseClient,
    scope: TenantScope,
    request: RightsRequest,
    action: RightsEvent['action'],
    note: string,
    evidenceRefs: string[],
  ): Promise<void> {
    const previous = (await this.repository.history(client, scope, request.id))[0]?.data;
    const content: Omit<RightsEvent, 'eventHash'> = {
      version: request.version,
      action,
      actorId: scope.userId,
      at: request.updatedAt,
      note,
      evidenceRefs,
      previousHash: previous?.eventHash ?? null,
      request,
    };
    await this.repository.append(client, scope, { ...content, eventHash: followupDigest(content) });
  }
}
