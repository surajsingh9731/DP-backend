import { FollowupCreationService } from '../followups/followup-creation.service.js';
import { ConflictException, BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ConsentReceipt, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { ConsentRepository } from './consent.repository.js';
import { ConsentSourceService } from './consent-source.service.js';
import { ConsentParticipantsService } from './consent-participants.service.js';
import { assertConsentEditor, completeChoices, consentHash } from './consent.policy.js';
import { SubmitConsentChoicesDto, WithdrawConsentChoicesDto } from './dto/consent.dto.js';
@Injectable()
export class ConsentChoicesService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: ConsentRepository,
    private readonly source: ConsentSourceService,
    private readonly participants: ConsentParticipantsService,
    private readonly followups: FollowupCreationService,
  ) {}
  record(
    scope: TenantScope,
    id: string,
    token: unknown,
    dto: SubmitConsentChoicesDto | WithdrawConsentChoicesDto,
    withdraw = false,
  ): Promise<ConsentReceipt> {
    assertConsentEditor(scope);
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const initial = await this.participants.authorize(client, scope, id, token);
      const offer = (await this.repository.offer(client, scope, initial.offerId)).data;
      await this.repository.lockCatalog(client, scope, offer.notice.id);
      const normalized =
        'choices' in dto
          ? {
              ...dto,
              choices: [...dto.choices].sort((a, b) => a.purposeId.localeCompare(b.purposeId)),
            }
          : { ...dto, purposeIds: [...dto.purposeIds].sort() };
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: withdraw ? 'withdraw' : 'choices',
        id,
        ...normalized,
      });
      const session = await this.participants.authorize(client, scope, id, token, true);
      if (command.response) return command.response as ConsentReceipt;
      const previous = (await this.repository.receipts(client, scope, id))[0]?.data;
      let choices;
      if (withdraw && 'purposeIds' in dto) {
        if (!previous || session.version !== dto.version)
          throw new ConflictException('Receipt version changed. Refresh before withdrawing.');
        if (
          dto.purposeIds.some(
            (p) => !previous.choices.some((c) => c.purposeId === p && c.decision === 'allow'),
          )
        )
          throw new BadRequestException('Only currently allowed purposes can be withdrawn.');
        choices = previous.choices.map((c) => ({
          ...c,
          decision: dto.purposeIds.includes(c.purposeId) ? ('decline' as const) : c.decision,
        }));
      } else if ('choices' in dto) {
        if (session.version !== 0)
          throw new ConflictException('Choices already recorded. Use withdrawal.');
        if (
          dto.offerId !== offer.id ||
          dto.offerVersion !== offer.version ||
          dto.catalogHash !== offer.catalogHash
        )
          throw new ConflictException('Offer/version binding does not match this session.');
        await this.source.current(client, scope, offer);
        choices = completeChoices(offer.purposes, dto.choices);
      } else throw new BadRequestException('Invalid consent operation.');
      const content: Omit<ConsentReceipt, 'receiptHash'> = {
        id: randomUUID(),
        sessionId: id,
        syntheticReference: `Sample adult ${id.slice(0, 8)}`,
        offer,
        version: session.version + 1,
        kind: withdraw ? 'choices_withdrawn' : 'choices_recorded',
        choices,
        interfaceLanguage: dto.interfaceLanguage,
        occurredAt: new Date().toISOString(),
        previousReceiptHash: previous?.receiptHash ?? null,
        mode: 'local-sample',
        assurance: 'unverified-synthetic-adult',
        legalReviewStatus: 'unreviewed',
        contactVerification: 'unverified',
        deletionStatus: 'not-performed',
      };
      const receipt: ConsentReceipt = { ...content, receiptHash: consentHash(content) };
      await this.repository.insertReceipt(client, scope, receipt);
      if (withdraw) await this.followups.ensure(client, scope, receipt.id);
      session.version = receipt.version;
      await this.repository.updateParticipant(client, session);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, receipt);
      return receipt;
    });
  }
}
