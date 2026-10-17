import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { RetentionRepository, type RetentionRecordKind } from './retention.repository.js';
import { retentionEditor, retentionOwner } from './retention.policy.js';
import { RetentionListDto } from './dto/retention.dto.js';
@Injectable()
export class RetentionRecordsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: RetentionRepository,
  ) {}
  list(scope: TenantScope, kind: RetentionRecordKind, dto: RetentionListDto) {
    retentionEditor(scope);
    if (kind === 'hold') retentionOwner(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.entry(client, scope, dto.entryId);
      const rows = await this.repository.list(
          client,
          scope,
          kind,
          dto.entryId,
          dto.limit,
          dto.after,
        ),
        items = rows.slice(0, dto.limit).map((row) => row.data);
      return { items, nextAfter: rows.length > dto.limit ? items.at(-1)!.id : null };
    });
  }
  detail(scope: TenantScope, kind: RetentionRecordKind, id: string) {
    retentionEditor(scope);
    if (kind === 'hold') retentionOwner(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const row = await this.repository.record(client, scope, kind, id);
      return {
        record: row.data,
        history: (await this.repository.history(client, scope, kind, id)).map(
          (event) => event.data,
        ),
      };
    });
  }
}
