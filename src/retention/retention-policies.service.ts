import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantScope, RetentionPolicy } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { RetentionRepository } from './retention.repository.js';
import { RetentionHistoryService } from './retention-history.service.js';
import { retentionEditor, retentionOwner, retentionVersion } from './retention.policy.js';
import {
  CreateRetentionPolicyDto,
  EditRetentionPolicyDto,
  RetentionPolicyActionDto,
} from './dto/retention.dto.js';
@Injectable()
export class RetentionPoliciesService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: RetentionRepository,
    private readonly history: RetentionHistoryService,
  ) {}
  create(scope: TenantScope, dto: CreateRetentionPolicyDto) {
    retentionEditor(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        operation: 'policy-create',
        ...dto,
        name: dto.name.trim(),
        rationale: dto.rationale.trim(),
      });
      if (command.response)
        return (await this.repository.record(client, scope, 'policy', command.response.id)).data;
      const entry = await this.repository.entry(client, scope, dto.entryId);
      retentionVersion(entry.version, dto.entryVersion);
      const record: RetentionPolicy = {
        id: randomUUID(),
        entryId: entry.id,
        entryVersion: entry.version,
        version: 1,
        name: dto.name.trim(),
        rationale: dto.rationale.trim(),
        durationDays: dto.durationDays,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        mode: 'local-sample',
        legalReview: 'unreviewed',
      };
      await this.repository.insert(client, scope, 'policy', record);
      await this.history.append(client, scope, 'policy', record, 'created', record.rationale);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'policy',
        id: record.id,
      });
      return record;
    });
  }
  edit(scope: TenantScope, id: string, dto: EditRetentionPolicyDto) {
    retentionEditor(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
          operation: 'policy-edit',
          id,
          ...dto,
          name: dto.name.trim(),
          rationale: dto.rationale.trim(),
        }),
        row = await this.repository.record(client, scope, 'policy', id, true);
      if (command.response) return row.data;
      const old = row.data as RetentionPolicy;
      retentionVersion(old.version, dto.version);
      if (old.status === 'retired') throw new ConflictException('Retired policy cannot change.');
      const entry = await this.repository.entry(client, scope, old.entryId);
      retentionVersion(entry.version, dto.entryVersion);
      const record: RetentionPolicy = {
        ...old,
        entryVersion: entry.version,
        name: dto.name.trim(),
        durationDays: dto.durationDays,
        rationale: dto.rationale.trim(),
        status: 'draft',
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.update(client, scope, 'policy', record);
      await this.history.append(client, scope, 'policy', record, 'edited', record.rationale);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'policy',
        id,
      });
      return record;
    });
  }
  action(scope: TenantScope, id: string, dto: RetentionPolicyActionDto) {
    retentionEditor(scope);
    if (dto.action !== 'submit') retentionOwner(scope);
    if (dto.action !== 'review' && dto.internalReviewAcknowledged !== undefined)
      throw new BadRequestException('Review acknowledgement belongs only to internal review.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
          operation: 'policy-action',
          id,
          ...dto,
          reason: dto.reason.trim(),
        }),
        row = await this.repository.record(client, scope, 'policy', id, true);
      if (command.response) return row.data;
      const old = row.data as RetentionPolicy;
      retentionVersion(old.version, dto.version);
      if (
        (dto.action === 'submit' && old.status !== 'draft') ||
        (dto.action === 'review' && old.status !== 'submitted') ||
        old.status === 'retired'
      )
        throw new ConflictException('Policy state does not permit this action.');
      const entry = await this.repository.entry(client, scope, old.entryId);
      if (dto.action !== 'retire') retentionVersion(entry.version, old.entryVersion);
      const status =
        dto.action === 'submit'
          ? 'submitted'
          : dto.action === 'review'
            ? 'internally_reviewed'
            : 'retired';
      const record: RetentionPolicy = {
        ...old,
        status,
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.update(client, scope, 'policy', record);
      await this.history.append(client, scope, 'policy', record, dto.action, dto.reason.trim());
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'policy',
        id,
      });
      return record;
    });
  }
}
