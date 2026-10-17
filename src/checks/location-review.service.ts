import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FollowupTask, MappingResult, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { FollowupsRepository } from '../followups/followups.repository.js';
import { FollowupHistoryService } from '../followups/followup-history.service.js';
import { followupDigest } from '../followups/followup-locations.js';
import { ChecksRepository } from './checks.repository.js';
import { ResolveLocationDto } from './dto/checks.dto.js';
@Injectable()
export class LocationReviewService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly tasks: FollowupsRepository,
    private readonly history: FollowupHistoryService,
    private readonly repository: ChecksRepository,
  ) {}
  resolve(scope: TenantScope, id: string, dto: ResolveLocationDto): Promise<MappingResult> {
    if (scope.role !== 'owner')
      throw new ForbiddenException('Only owners can resolve a synthetic location mapping.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        operation: 'mapping',
        id,
        ...dto,
        name: dto.name.trim(),
        detail: dto.detail.trim(),
        rationale: dto.rationale.trim(),
        evidenceRefs: [...dto.evidenceRefs].sort(),
      });
      const initial = (await this.tasks.task(client, scope, id)).data;
      await this.tasks.lockReceipt(client, scope, initial.receiptId);
      const original = (await this.tasks.task(client, scope, id, true)).data;
      if (command.response) return command.response as MappingResult;
      if (original.version !== dto.taskVersion)
        throw new ConflictException('Task version changed. Refresh before mapping.');
      if (original.location.mapping !== 'unknown')
        throw new ConflictException('Only an unresolved location can be mapped here.');
      const paper = original.location.name === 'paper';
      if (paper && dto.kind !== 'paper')
        throw new ConflictException('Paper coverage must resolve to a concrete paper location.');
      const name = dto.name.trim(),
        detail = dto.detail.trim();
      const normalize = (value: string) =>
        value.normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase();
      const location = {
        key: followupDigest({ kind: dto.kind, name: normalize(name), detail: normalize(detail) }),
        kind: dto.kind,
        name,
        detail,
        mapping: 'declared' as const,
      };
      if (await this.tasks.locationTask(client, scope, original.receiptId, location.key))
        throw new ConflictException(
          'This receipt already has that candidate location. Review the existing task.',
        );
      const at = new Date().toISOString(),
        resolution = {
          originalLocation: original.location,
          reviewedBy: scope.userId,
          reviewedAt: at,
          rationale: dto.rationale.trim(),
          evidenceRefs: [...dto.evidenceRefs].sort(),
        };
      const parent: FollowupTask = {
        ...original,
        version: original.version + 1,
        updatedAt: at,
        ...(paper ? { location, status: 'pending' as const, mappingResolution: resolution } : {}),
      };
      let child: FollowupTask | null = null;
      if (!paper) {
        child = {
          ...original,
          id: randomUUID(),
          location,
          status: 'pending',
          version: 1,
          updatedAt: at,
          responsibleRole: 'owner',
          assignee: null,
          declaredBy: null,
          declaredEvidence: [],
          mappingResolution: resolution,
          parentMappingTaskId: original.id,
        };
        parent.mappedTaskIds = [...(original.mappedTaskIds ?? []), child.id];
        await this.tasks.insert(client, scope, child);
        await this.history.append(
          client,
          scope,
          child,
          'created',
          dto.rationale.trim(),
          resolution.evidenceRefs,
          null,
        );
      }
      const previous = (await this.tasks.history(client, scope, id))[0]?.data;
      await this.tasks.update(client, scope, parent);
      await this.history.append(
        client,
        scope,
        parent,
        paper ? 'mapping_resolved' : 'mapping_added',
        dto.rationale.trim(),
        resolution.evidenceRefs,
        previous?.eventHash ?? null,
      );
      const result = { parent, child };
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, result);
      return result;
    });
  }
}
