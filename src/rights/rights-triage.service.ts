import { Injectable, BadRequestException } from '@nestjs/common';
import type { RightsDetail, RightsRequest, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { FollowupsRepository } from '../followups/followups.repository.js';
import { RightsRepository } from './rights.repository.js';
import { RightsHistoryService } from './rights-history.service.js';
import { rightsSummary } from './rights.mapper.js';
import { assertRightsOperator, transitionRights } from './rights.policy.js';
import { RightsActionDto } from './dto/rights.dto.js';
@Injectable()
export class RightsTriageService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: RightsRepository,
    private readonly history: RightsHistoryService,
    private readonly assignees: FollowupsRepository,
  ) {}
  list(scope: TenantScope) {
    assertRightsOperator(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return (await this.repository.list(client, scope)).map((row) => rightsSummary(row.data));
    });
  }
  detail(scope: TenantScope, id: string): Promise<RightsDetail> {
    assertRightsOperator(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const row = await this.repository.request(client, scope, id);
      return {
        ...row.data,
        history: (await this.repository.history(client, scope, id)).map((event) => event.data),
      };
    });
  }
  action(scope: TenantScope, id: string, dto: RightsActionDto): Promise<RightsRequest> {
    assertRightsOperator(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const payload = {
        ...dto,
        note: dto.note.trim(),
        evidenceRefs: [...dto.evidenceRefs].sort(),
        ...(dto.response ? { response: { ...dto.response, text: dto.response.text.trim() } } : {}),
      };
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        operation: 'rights-action',
        id,
        ...payload,
      });
      const row = await this.repository.request(client, scope, id, true);
      assertRightsOperator(scope, row.data);
      if (command.response) return command.response as RightsRequest;
      let next = transitionRights(row.data, dto, scope);
      if (dto.action === 'assign') {
        if (dto.assigneeId === undefined)
          throw new BadRequestException(
            'Select a colleague or explicitly return responsibility to the owner.',
          );
        next = {
          ...next,
          assignee:
            dto.assigneeId === null
              ? null
              : await this.assignees.assignee(client, scope, dto.assigneeId),
        };
      }
      await this.repository.update(client, scope, next);
      await this.history.append(
        client,
        scope,
        next,
        dto.action,
        payload.note,
        payload.evidenceRefs,
      );
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, next);
      return next;
    });
  }
}
