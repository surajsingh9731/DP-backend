import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TenantScope, RetentionSnapshot, RetentionPreviewPage } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { RetentionRepository } from './retention.repository.js';
import { RetentionInputsService } from './retention-inputs.service.js';
import { retentionOwner } from './retention.policy.js';
import { retentionInstant, retentionCandidates } from './retention-preview.policy.js';
import { retentionPreviewPage } from './retention-preview.mapper.js';
import { followupDigest } from '../followups/followup-locations.js';
import {
  CreateRetentionPreviewDto,
  RetentionPreviewPageDto,
  RetentionListDto,
} from './dto/retention.dto.js';
import { RETENTION_LIMITS } from '../constants/retention.constants.js';
@Injectable()
export class RetentionPreviewsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: RetentionRepository,
    private readonly inputs: RetentionInputsService,
  ) {}
  private async snapshot<T>(
    scope: TenantScope,
    work: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.transaction(scope.tenantId, work, 'REPEATABLE READ');
      } catch (error) {
        const driver =
          error && typeof error === 'object' && 'driverError' in error ? error.driverError : error;
        const code = driver && typeof driver === 'object' && 'code' in driver ? driver.code : null;
        const constraint =
          driver && typeof driver === 'object' && 'constraint' in driver ? driver.constraint : null;
        if (code !== '40001' && !(code === '23505' && constraint === 'retention_commands_pkey'))
          throw error;
        if (attempt === 2)
          throw new ConflictException('Concurrent inputs changed. Retry this snapshot command.');
      }
    }
    throw new ConflictException('Snapshot retry unavailable.');
  }
  context(scope: TenantScope, id: string) {
    retentionOwner(scope);
    return this.db.transaction(
      scope.tenantId,
      async (client) => {
        await this.authorization.assertCurrent(client, scope);
        return this.inputs.view(await this.inputs.load(client, scope, id));
      },
      'REPEATABLE READ',
    );
  }
  list(scope: TenantScope, dto: RetentionListDto) {
    retentionOwner(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.entry(client, scope, dto.entryId);
      const rows = await this.repository.previews(client, scope, dto.entryId, dto.limit, dto.after),
        items = rows.slice(0, dto.limit).map((row) => ({
          id: row.id,
          entryId: row.entryId,
          asOf: row.data.asOf,
          createdAt: row.data.createdAt,
          contentHash: row.data.contentHash,
        }));
      return { items, nextAfter: rows.length > dto.limit ? items.at(-1)!.id : null };
    });
  }
  private async view(
    client: DatabaseClient,
    scope: TenantScope,
    snapshot: RetentionSnapshot,
    page: RetentionPreviewPageDto,
  ) {
    let freshness: RetentionPreviewPage['freshness'] = 'source_unavailable';
    try {
      const current = await this.inputs.load(client, scope, snapshot.entryId);
      freshness =
        followupDigest(current) === snapshot.inputHash ? 'matches_loaded_inputs' : 'stale';
    } catch (error) {
      if (!(error instanceof ConflictException) && !(error instanceof NotFoundException))
        throw error;
    }
    return retentionPreviewPage(snapshot, freshness, page.limit, page.cursor);
  }
  get(scope: TenantScope, id: string, page: RetentionPreviewPageDto) {
    retentionOwner(scope);
    return this.db.transaction(
      scope.tenantId,
      async (client) => {
        await this.authorization.assertCurrent(client, scope);
        return this.view(client, scope, await this.repository.preview(client, scope, id), page);
      },
      'REPEATABLE READ',
    );
  }
  create(scope: TenantScope, dto: CreateRetentionPreviewDto) {
    retentionOwner(scope);
    const asOf = retentionInstant(dto.asOf);
    return this.snapshot(scope, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        operation: 'dry-run',
        entryId: dto.entryId,
        asOf,
      });
      if (command.response)
        return this.view(
          client,
          scope,
          await this.repository.preview(client, scope, command.response.id),
          { limit: RETENTION_LIMITS.page },
        );
      const inputs = await this.inputs.load(client, scope, dto.entryId),
        content: Omit<RetentionSnapshot, 'contentHash'> = {
          id: randomUUID(),
          entryId: dto.entryId,
          asOf,
          createdAt: new Date().toISOString(),
          createdBy: scope.userId,
          inputHash: followupDigest(inputs),
          inputs,
          candidates: retentionCandidates(inputs, asOf),
          mode: 'local-sample',
          execution: 'not-available',
        },
        snapshot: RetentionSnapshot = { ...content, contentHash: followupDigest(content) };
      await this.repository.previewInsert(client, scope, snapshot);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        kind: 'preview',
        id: snapshot.id,
      });
      return retentionPreviewPage(snapshot, 'matches_loaded_inputs', RETENTION_LIMITS.page);
    });
  }
}
