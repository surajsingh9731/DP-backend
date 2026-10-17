import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ConsentOffer, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { ConsentRepository } from './consent.repository.js';
import { ConsentSourceService } from './consent-source.service.js';
import { consentHash, normalizePurposes } from './consent.policy.js';
import { CreateConsentOfferDto } from './dto/consent.dto.js';
@Injectable()
export class ConsentOffersService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: ConsentRepository,
    private readonly source: ConsentSourceService,
  ) {}
  list(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return (await this.repository.offers(client, scope)).map((row) => row.data);
    });
  }
  create(scope: TenantScope, dto: CreateConsentOfferDto): Promise<ConsentOffer> {
    if (scope.role !== 'owner')
      throw new ForbiddenException('Only owners configure synthetic purpose catalogs.');
    const purposes = normalizePurposes(dto.purposes);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.lockCatalog(client, scope, dto.noticeId);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'offer',
        noticeId: dto.noticeId,
        purposes,
      });
      if (command.response) return command.response as ConsentOffer;
      const notice = await this.source.notice(client, scope, dto.noticeId);
      const version =
        ((await this.repository.latest(client, scope, dto.noticeId))?.version ?? 0) + 1;
      const data: ConsentOffer = {
        id: randomUUID(),
        version,
        catalogHash: consentHash({ notice, purposes }),
        notice,
        purposes,
        createdAt: new Date().toISOString(),
      };
      await this.repository.insertOffer(client, scope, data);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, data);
      return data;
    });
  }
}
