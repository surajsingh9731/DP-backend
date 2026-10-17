import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantScope, RetentionHold } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { RetentionRepository } from './retention.repository.js';
import { RetentionInputsService } from './retention-inputs.service.js';
import { RetentionHistoryService } from './retention-history.service.js';
import { retentionOwner, retentionVersion } from './retention.policy.js';
import { CreateRetentionHoldDto, ReleaseRetentionHoldDto } from './dto/retention.dto.js';
@Injectable()
export class RetentionHoldsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: RetentionRepository,
    private readonly inputs: RetentionInputsService,
    private readonly history: RetentionHistoryService,
  ) {}
  create(scope: TenantScope, dto: CreateRetentionHoldDto) {
    retentionOwner(scope);
    if (
      (dto.scope === 'activity' && dto.target !== undefined) ||
      (dto.scope !== 'activity' && !dto.target)
    )
      throw new BadRequestException('Hold target does not match its scope.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        operation: 'hold-create',
        ...dto,
        reason: dto.reason.trim(),
      });
      if (command.response)
        return (await this.repository.record(client, scope, 'hold', command.response.id)).data;
      await this.repository.entry(client, scope, dto.entryId);
      const context =
        dto.scope === 'activity'
          ? null
          : this.inputs.view(await this.inputs.load(client, scope, dto.entryId));
      const target = dto.target?.toLowerCase() ?? null;
      if (
        (dto.scope === 'sample_record' &&
          !context?.sampleRecords.some((row) => row.id === target)) ||
        (dto.scope === 'location' && !context?.locations.some((row) => row.key === target))
      )
        throw new BadRequestException('Target unavailable in this synthetic activity scope.');
      const record: RetentionHold = {
        id: randomUUID(),
        entryId: dto.entryId,
        version: 1,
        scope: dto.scope,
        target,
        reason: dto.reason.trim(),
        status: 'active',
        updatedAt: new Date().toISOString(),
        mode: 'local-sample',
      };
      await this.repository.insert(client, scope, 'hold', record);
      await this.history.append(client, scope, 'hold', record, 'created', record.reason);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'hold',
        id: record.id,
      });
      return record;
    });
  }
  release(scope: TenantScope, id: string, dto: ReleaseRetentionHoldDto) {
    retentionOwner(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
          operation: 'hold-release',
          id,
          ...dto,
          reason: dto.reason.trim(),
        }),
        row = await this.repository.record(client, scope, 'hold', id, true);
      if (command.response) return row.data;
      const old = row.data as RetentionHold;
      retentionVersion(old.version, dto.version);
      if (old.status !== 'active') throw new ConflictException('Hold is already released.');
      const record: RetentionHold = {
        ...old,
        status: 'released',
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.update(client, scope, 'hold', record);
      await this.history.append(client, scope, 'hold', record, 'released', dto.reason.trim());
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'hold',
        id,
      });
      return record;
    });
  }
}
