import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ParticipantRightsRequest,
  ParticipantRightsView,
  RightsRequest,
  TenantScope,
} from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { ConsentParticipantsService } from '../consent-sandbox/consent-participants.service.js';
import { assertConsentEditor } from '../consent-sandbox/consent.policy.js';
import { RightsRepository } from './rights.repository.js';
import { RightsSourceService } from './rights-source.service.js';
import { RightsHistoryService } from './rights-history.service.js';
import { publicRights } from './rights.mapper.js';
import { SubmitRightsDto } from './dto/rights.dto.js';
@Injectable()
export class ParticipantRightsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly participants: ConsentParticipantsService,
    private readonly repository: RightsRepository,
    private readonly source: RightsSourceService,
    private readonly history: RightsHistoryService,
  ) {}
  list(scope: TenantScope, sessionId: string, token: unknown): Promise<ParticipantRightsView> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const session = await this.participants.authorize(client, scope, sessionId, token);
      const rows = await this.repository.list(client, scope, sessionId);
      return {
        sessionId,
        syntheticReference: `Sample adult ${sessionId.slice(0, 8)}`,
        expiresAt: session.expiresAt.toISOString(),
        requests: await Promise.all(
          rows.map(async (row) =>
            publicRights(
              row.data,
              (await this.repository.history(client, scope, row.id)).map((event) => event.data),
            ),
          ),
        ),
      };
    });
  }
  detail(
    scope: TenantScope,
    sessionId: string,
    id: string,
    token: unknown,
  ): Promise<ParticipantRightsRequest> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.participants.authorize(client, scope, sessionId, token);
      const row = await this.repository.request(client, scope, id, false, sessionId);
      return publicRights(
        row.data,
        (await this.repository.history(client, scope, id)).map((event) => event.data),
      );
    });
  }
  submit(
    scope: TenantScope,
    sessionId: string,
    token: unknown,
    dto: SubmitRightsDto,
  ): Promise<ParticipantRightsRequest> {
    assertConsentEditor(scope);
    if (dto.kind !== 'correction' && dto.correction !== undefined)
      throw new BadRequestException('Correction fields belong only to a correction request.');
    const details = dto.details.trim(),
      correction = dto.correction
        ? {
            fieldReference: dto.correction.fieldReference.trim(),
            requestedValue: dto.correction.requestedValue.trim(),
          }
        : undefined;
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const session = await this.participants.authorize(client, scope, sessionId, token, true);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'submit',
        sessionId,
        requestKind: dto.kind,
        inputLanguage: dto.inputLanguage,
        details,
        correction: correction ?? null,
      });
      if (command.response) {
        const id =
          'requestId' in command.response ? command.response.requestId : command.response.id;
        const row = await this.repository.request(client, scope, id, false, sessionId);
        return publicRights(
          row.data,
          (await this.repository.history(client, scope, id)).map((event) => event.data),
        );
      }
      const source = await this.source.build(client, scope, sessionId, session.offerId, dto.kind),
        at = new Date().toISOString();
      const request: RightsRequest = {
        id: randomUUID(),
        sessionId,
        syntheticReference: `Sample adult ${sessionId.slice(0, 8)}`,
        kind: dto.kind,
        inputLanguage: dto.inputLanguage,
        details,
        ...(correction ? { correction } : {}),
        ...source,
        status: 'requested',
        version: 1,
        assignee: null,
        responses: [],
        submittedAt: at,
        updatedAt: at,
        mode: 'local-sample',
        assurance: 'unverified-synthetic-adult',
      };
      await this.repository.insert(client, scope, request);
      await this.history.append(
        client,
        scope,
        request,
        'submitted',
        'Synthetic participant request recorded; no consent or legal assurance inferred.',
        [],
      );
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, {
        requestId: request.id,
      });
      return publicRights(
        request,
        (await this.repository.history(client, scope, request.id)).map((event) => event.data),
      );
    });
  }
}
