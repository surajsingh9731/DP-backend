import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  PreparationData,
  PreparationKind,
  PreparationRecordView,
  SourcePack,
  TenantScope,
} from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
import { SECTOR_PACK_REGISTRY } from '../constants/setup.constants.js';
import { PREPARATION_STATUS } from '../constants/preparation.constants.js';
import { PreparationRepository } from './preparation.repository.js';
import { preparationView } from './preparation.mapper.js';
import { assertPreparationEditor, nextPreparationStatus } from './preparation.policy.js';
import { SaveTemplateDto, SaveContactDto } from './dto/save-preparation.dto.js';
import { PreparationActionDto } from './dto/preparation-action.dto.js';
import type { PreparationRecordEntity } from './entities/index.js';
@Injectable()
export class PreparationService {
  constructor(
    private readonly db: Database,
    private readonly repository: PreparationRepository,
    private readonly authorization: TenantAuthorizationService,
  ) {}
  list(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return (await this.repository.list(client, scope)).map((row) => preparationView(row));
    });
  }
  private async record(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    const row = await this.repository.record(client, scope, id, lock);
    if (!row) throw new NotFoundException('Preparation record is unavailable.');
    return row;
  }
  private async current(client: DatabaseClient, scope: TenantScope, id: string) {
    return preparationView(
      await this.record(client, scope, id),
      await this.repository.history(client, scope, id),
    );
  }
  detail(scope: TenantScope, id: string) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return this.current(client, scope, id);
    });
  }
  private hash(value: unknown): string {
    return createHash(SECURITY_HASH_ALGORITHM).update(JSON.stringify(value)).digest('hex');
  }
  private async replay(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await this.repository.lockCommand(client, scope, key);
    const hash = this.hash(payload),
      prior = await this.repository.command(client, scope, key);
    if (prior && prior.payloadHash !== hash)
      throw new ConflictException('Idempotency key has a different payload.');
    return { hash, response: prior?.response };
  }
  async save(
    scope: TenantScope,
    kind: PreparationKind,
    dto: SaveTemplateDto | SaveContactDto,
    id?: string,
  ): Promise<PreparationRecordView> {
    assertPreparationEditor(kind, scope.role);
    const template = dto instanceof SaveTemplateDto;
    const data: PreparationData = template
      ? {
          title: dto.title.trim(),
          body: dto.body.trim(),
          language: dto.language,
          sourceKind: dto.sourceKind,
        }
      : { displayName: dto.displayName.trim(), email: dto.email.trim().toLowerCase() };
    const pack =
      template && dto.sourceKind === 'education-sample'
        ? SECTOR_PACK_REGISTRY.find((item) => item.id === 'education' && item.available)
        : undefined;
    const sourcePack: SourcePack | null = pack
      ? { id: pack.id, version: pack.version, reviewStatus: 'unreviewed' }
      : null;
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const priorCommand = await this.replay(client, scope, dto.idempotencyKey, {
        operation: 'save',
        actor: scope.userId,
        kind,
        id: id ?? null,
        version: dto.version,
        data,
        sourcePack,
      });
      if (priorCommand.response) return priorCommand.response;
      const prior = id ? await this.record(client, scope, id, true) : null;
      if ((prior && prior.kind !== kind) || (prior?.version ?? 0) !== dto.version)
        throw new ConflictException('Preparation version changed. Refresh before saving.');
      const row: PreparationRecordEntity = {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        id: prior?.id ?? randomUUID(),
        kind,
        version: (prior?.version ?? 0) + 1,
        status: PREPARATION_STATUS.draft,
        data,
        sourcePack,
        contentHash: this.hash({ kind, data, sourcePack }),
        updatedAt: new Date(),
      };
      if (prior) await this.repository.update(client, row);
      else await this.repository.insert(client, row);
      await this.revision(client, scope, row, 'saved', null);
      const response = await this.current(client, scope, row.id);
      await this.repository.saveCommand(
        client,
        scope,
        dto.idempotencyKey,
        priorCommand.hash,
        response,
      );
      return response;
    });
  }
  private revision(
    client: DatabaseClient,
    scope: TenantScope,
    row: PreparationRecordEntity,
    action: 'saved' | PreparationActionDto['action'],
    comment: string | null,
  ) {
    return this.repository.revision(client, {
      tenantId: scope.tenantId,
      recordId: row.id,
      version: row.version,
      data: row.data,
      sourcePack: row.sourcePack,
      status: row.status,
      contentHash: row.contentHash,
      action,
      comment,
      actorId: scope.userId,
    });
  }
  action(
    scope: TenantScope,
    id: string,
    dto: PreparationActionDto,
  ): Promise<PreparationRecordView> {
    if (scope.role === 'viewer' || (dto.action !== 'submit' && scope.role !== 'owner'))
      throw new ForbiddenException('This role cannot record this internal action.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const comment = dto.comment?.trim() || null;
      const prior = await this.replay(client, scope, dto.idempotencyKey, {
        operation: 'action',
        actor: scope.userId,
        id,
        version: dto.version,
        action: dto.action,
        comment,
        acknowledged: dto.internalOnlyAcknowledged === true,
      });
      if (prior.response) {
        assertPreparationEditor(prior.response.kind, scope.role);
        return prior.response;
      }
      const row = await this.record(client, scope, id, true);
      assertPreparationEditor(row.kind, scope.role);
      if (row.version !== dto.version)
        throw new ConflictException('Preparation version changed. Refresh before reviewing.');
      row.status = nextPreparationStatus(row.status, dto, scope.role);
      row.version += 1;
      row.updatedAt = new Date();
      await this.repository.update(client, row);
      await this.revision(client, scope, row, dto.action, comment);
      const response = await this.current(client, scope, id);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, prior.hash, response);
      return response;
    });
  }
}
