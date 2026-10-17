import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SetupView, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { SetupDraftEntity } from '../database/entities/index.js';
import { SECTOR_PACK_REGISTRY, SETUP_STATUS } from '../constants/setup.constants.js';
import { WORKSPACE_ROLES } from '../constants/security.constants.js';
import { cleanRegisterData } from '../register/register.validation.js';
import { SaveSetupDto, CompleteSetupDto } from './dto/setup.dto.js';
import { SetupRepository } from './setup.repository.js';
import { sectorPacks } from './sector-packs.js';
const view = (row: SetupDraftEntity): SetupView => ({
  version: row.version,
  organisationName: row.organisationName,
  packId: row.packId,
  packVersion: row.packVersion,
  step: row.step,
  draft: row.draft,
  status: row.status,
  registerEntryId: row.registerEntryId,
  updatedAt: row.updatedAt.toISOString(),
});
@Injectable()
export class SetupService {
  constructor(
    private readonly db: Database,
    private readonly repository: SetupRepository,
    private readonly authorization: TenantAuthorizationService,
  ) {}

  async get(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const row = await this.repository.row(client, scope);
      return { setup: row ? view(row) : null, packs: sectorPacks() };
    });
  }
  async save(scope: TenantScope, dto: SaveSetupDto): Promise<SetupView> {
    if (scope.role === WORKSPACE_ROLES.viewer)
      throw new ForbiddenException('Reviewers have read-only access.');
    const name = dto.organisationName.trim();
    if (!name) throw new BadRequestException('Enter an organisation name.');
    const pack = SECTOR_PACK_REGISTRY.find(
      (p) => p.id === dto.packId && p.version === dto.packVersion && p.available,
    );
    if (!pack)
      throw new BadRequestException('Only the versioned Education sample pack is available.');
    if (dto.draft === undefined || (dto.step >= 2 && !dto.draft))
      throw new BadRequestException('A complete activity draft is required for this step.');
    const draft = dto.draft ? cleanRegisterData(dto.draft) : null;
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.lock(client, scope);
      const prior = await this.repository.row(client, scope, true);
      if (prior && (prior.packId !== dto.packId || prior.packVersion !== dto.packVersion))
        throw new ConflictException(
          'The saved pack version is pinned. Start a reviewed migration to change it.',
        );
      if (prior?.status === SETUP_STATUS.completed)
        throw new ConflictException('Setup is already completed.');
      if ((prior?.version ?? 0) !== dto.version)
        throw new ConflictException('Setup changed. Refresh before saving.');
      if (scope.role !== WORKSPACE_ROLES.owner && (!prior || prior.organisationName !== name))
        throw new ForbiddenException('Only the owner can choose the organisation and pack.');
      if (prior)
        await this.repository.update(client, scope, {
          version: prior.version + 1,
          step: dto.step,
          draft,
          organisationName: name,
        });
      else
        await this.repository.insert(client, scope, {
          organisationName: name,
          packId: dto.packId,
          packVersion: dto.packVersion,
          step: dto.step,
          draft,
        });
      return view((await this.repository.row(client, scope))!);
    });
  }
  async complete(scope: TenantScope, dto: CompleteSetupDto): Promise<SetupView> {
    if (scope.role !== WORKSPACE_ROLES.owner)
      throw new ForbiddenException('Only the owner can complete setup.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.lock(client, scope);
      const prior = await this.repository.row(client, scope, true);
      if (prior?.status === SETUP_STATUS.completed) {
        if (prior.completionKey === dto.idempotencyKey) return view(prior);
        throw new ConflictException('Setup is already completed with another completion key.');
      }
      if (!prior || prior.version !== dto.version)
        throw new ConflictException('Setup changed. Refresh before completing.');
      if (prior.step !== 3 || !prior.draft)
        throw new ConflictException('Review the complete activity draft before completing.');
      const id = randomUUID();
      await this.repository.createRegister(client, scope, id, prior);
      await this.repository.complete(client, scope, id, dto.idempotencyKey, prior.version + 1);
      return view((await this.repository.row(client, scope))!);
    });
  }
}
