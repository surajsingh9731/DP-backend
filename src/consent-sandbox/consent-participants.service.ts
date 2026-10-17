import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ConsentParticipant, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { hashToken } from '../auth/security-hash.js';
import { SESSION_TOKEN_PATTERN } from '../constants/security.constants.js';
import { CONSENT_LIMITS } from '../constants/consent.constants.js';
import { ConsentRepository } from './consent.repository.js';
import { ConsentSourceService } from './consent-source.service.js';
import { assertConsentEditor } from './consent.policy.js';
import type { ConsentParticipantEntity } from './entities/index.js';
@Injectable()
export class ConsentParticipantsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: ConsentRepository,
    private readonly source: ConsentSourceService,
  ) {}
  async authorize(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    token: unknown,
    lock = false,
  ) {
    const row = await this.repository.participant(client, scope, id, lock);
    if (
      typeof token !== 'string' ||
      !SESSION_TOKEN_PATTERN.test(token) ||
      row.actorId !== scope.userId ||
      row.revoked ||
      row.expiresAt.getTime() <= Date.now() ||
      !timingSafeEqual(Buffer.from(hashToken(token)), Buffer.from(row.tokenHash))
    )
      throw new ForbiddenException(
        'Synthetic session expired or unavailable. Start another sample participant.',
      );
    return row;
  }
  async view(
    client: DatabaseClient,
    scope: TenantScope,
    row: ConsentParticipantEntity,
  ): Promise<ConsentParticipant> {
    return {
      id: row.id,
      offer: (await this.repository.offer(client, scope, row.offerId)).data,
      syntheticReference: `Sample adult ${row.id.slice(0, 8)}`,
      expiresAt: row.expiresAt.toISOString(),
      version: row.version,
      receipts: (await this.repository.receipts(client, scope, row.id)).map((r) => r.data),
    };
  }
  start(scope: TenantScope, offerId: string) {
    assertConsentEditor(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const offer = (await this.repository.offer(client, scope, offerId)).data;
      await this.repository.lockCatalog(client, scope, offer.notice.id);
      await this.source.current(client, scope, offer);
      const token = randomBytes(32).toString('hex');
      const row: ConsentParticipantEntity = {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        id: randomUUID(),
        offerId,
        actorId: scope.userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + CONSENT_LIMITS.sessionSeconds * 1000),
        revoked: false,
        version: 0,
      };
      await this.repository.insertParticipant(client, row);
      return { token, participant: await this.view(client, scope, row) };
    });
  }
  get(scope: TenantScope, id: string, token: unknown) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return this.view(client, scope, await this.authorize(client, scope, id, token));
    });
  }
  end(scope: TenantScope, id: string, token: unknown) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const row = await this.authorize(client, scope, id, token, true);
      row.revoked = true;
      await this.repository.updateParticipant(client, row);
      return { ended: true };
    });
  }
  ledger(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return (await this.repository.receipts(client, scope)).map((row) => row.data);
    });
  }
}
