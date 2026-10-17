import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  NoticePreview,
  RegisterRevision,
  RegisterView,
  TenantScope,
} from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { RegisterEntryEntity } from '../database/entities/index.js';
import { REGISTER_EDIT_ROLE } from '../constants/register.constants.js';
import { RegisterDto } from './dto/register.dto.js';
import { cleanRegisterData } from './register.validation.js';
import { RegisterRepository } from './register.repository.js';
import { renderNoticePreview } from './notice-preview.renderer.js';
const view = (row: RegisterEntryEntity, sourcePack?: RegisterView['sourcePack']): RegisterView => ({
  ...row.data,
  ...(sourcePack ? { sourcePack } : {}),
  id: row.id,
  version: row.version,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
@Injectable()
export class RegisterService {
  constructor(
    private readonly db: Database,
    private readonly repository: RegisterRepository,
    private readonly authorization: TenantAuthorizationService,
  ) {}

  private async entry(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    const row = await this.repository.entry(client, scope, id, lock);
    if (!row) throw new NotFoundException('Register entry is unavailable.');
    return row;
  }
  async list(scope: TenantScope): Promise<RegisterView[]> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const rows = await this.repository.list(client, scope);
      const sources = await this.repository.sources(
        client,
        scope,
        rows.map((row) => row.id),
      );
      return rows.map((row) => view(row, sources.get(row.id)));
    });
  }
  async save(
    scope: TenantScope,
    dto: RegisterDto,
    id?: string,
    version?: number,
  ): Promise<RegisterView> {
    if (scope.role !== REGISTER_EDIT_ROLE)
      throw new ForbiddenException('Only the workspace owner can edit draft register entries.');
    const data = cleanRegisterData(dto);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      let row: RegisterEntryEntity;
      if (id) {
        const prior = await this.entry(client, scope, id, true);
        if (prior.version !== version)
          throw new ConflictException('Register entry changed. Refresh before saving.');
        await this.repository.update(client, scope, id, data, prior.version + 1);
        row = await this.entry(client, scope, id);
      } else {
        const key = randomUUID();
        await this.repository.insert(client, scope, key, data);
        row = await this.entry(client, scope, key);
      }
      await this.repository.revision(client, scope, row.id, data, row.version);
      return view(row, await this.repository.source(client, scope, row.id));
    });
  }
  async history(scope: TenantScope, id: string): Promise<RegisterRevision[]> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.entry(client, scope, id);
      const rows = await this.repository.history(client, scope, id);
      return rows.map((row) => ({
        version: row.version,
        data: row.data,
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }
  async preview(scope: TenantScope, id: string, language: 'en' | 'hi'): Promise<NoticePreview> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const row = await this.entry(client, scope, id);
      const sourcePack = await this.repository.source(client, scope, id);
      return renderNoticePreview(row.data, id, row.version, language, sourcePack);
    });
  }
}
