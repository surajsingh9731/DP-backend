import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import type { ConsentOffer, ConsentParticipant, ConsentReceipt } from '@sahmati/contracts';
import { ConsentOfferEntity } from '../entities/consent-offer.entity';
import { ConsentParticipantEntity } from '../entities/consent-participant.entity';
import { ConsentReceiptEntity } from '../entities/consent-receipt.entity';
import { CreateOfferDto } from '../dto/create-offer.dto';
import { SubmitChoicesDto, WithdrawChoicesDto } from '../dto/submit-choices.dto';
import { NoticesService } from '../../notices/services/notices.service';

const SESSION_TTL_MS = 60 * 60_000;

@Injectable()
export class ConsentSandboxService {
  constructor(
    @InjectRepository(ConsentOfferEntity) private readonly offers: Repository<ConsentOfferEntity>,
    @InjectRepository(ConsentParticipantEntity)
    private readonly participants: Repository<ConsentParticipantEntity>,
    @InjectRepository(ConsentReceiptEntity) private readonly receipts: Repository<ConsentReceiptEntity>,
    private readonly notices: NoticesService,
  ) {}

  async listOffers(tenantId: string): Promise<ConsentOffer[]> {
    const rows = await this.offers.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.offerView(row));
  }

  async createOffer(tenantId: string, dto: CreateOfferDto): Promise<ConsentOffer> {
    const notice = await this.notices.get(tenantId, dto.noticeId);
    if (notice.status !== 'sample_published') {
      throw new BadRequestException('The chosen notice is not yet published as a sample.');
    }
    const catalogHash = createHash('sha256').update(JSON.stringify(dto.purposes)).digest('hex');
    const row = await this.offers.save(
      this.offers.create({
        tenantId,
        version: 1,
        catalogHash,
        notice: {
          id: notice.id,
          entryVersion: notice.entryVersion,
          language: notice.language,
          title: notice.preview.title,
          body: notice.preview.body,
          warning: notice.preview.warning,
        },
        purposes: dto.purposes,
      }),
    );
    return this.offerView(row);
  }

  async ledger(tenantId: string): Promise<ConsentReceipt[]> {
    const rows = await this.receipts.find({ where: { tenantId }, order: { occurredAt: 'DESC' } });
    return rows.map((row) => this.receiptView(row));
  }

  async startSession(tenantId: string, offerId: string): Promise<ConsentParticipant> {
    const offer = await this.offers.findOne({ where: { id: offerId, tenantId } });
    if (!offer) throw new NotFoundException('Consent offer not found.');
    const participant = await this.participants.save(
      this.participants.create({
        tenantId,
        offerId,
        syntheticReference: `Synthetic adult ${randomUUID().slice(0, 8)}`,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        version: 0,
        ended: false,
      }),
    );
    return this.participantView(participant, offer, []);
  }

  async getSession(tenantId: string, id: string): Promise<ConsentParticipant> {
    const { participant, offer } = await this.findSession(tenantId, id);
    const receipts = await this.receipts.find({
      where: { tenantId, sessionId: id },
      order: { occurredAt: 'ASC' },
    });
    return this.participantView(participant, offer, receipts);
  }

  async endSession(tenantId: string, id: string): Promise<void> {
    const { participant } = await this.findSession(tenantId, id);
    participant.ended = true;
    await this.participants.save(participant);
  }

  async recordChoices(
    tenantId: string,
    sessionId: string,
    dto: SubmitChoicesDto,
  ): Promise<ConsentReceipt> {
    const { participant, offer } = await this.findSession(tenantId, sessionId);
    if (participant.version !== 0) {
      throw new ConflictException('Choices were already recorded for this session.');
    }
    if (offer.version !== dto.offerVersion || offer.catalogHash !== dto.catalogHash) {
      throw new ConflictException('The offer changed since this session started.');
    }
    const offerView = this.offerView(offer);
    const previous = await this.lastReceipt(tenantId, sessionId);
    const receipt = this.receipts.create({
      tenantId,
      sessionId,
      syntheticReference: participant.syntheticReference,
      offer: offerView,
      version: participant.version + 1,
      kind: 'choices_recorded',
      choices: dto.choices,
      interfaceLanguage: dto.interfaceLanguage,
      previousReceiptHash: previous?.receiptHash ?? null,
      receiptHash: '',
    });
    receipt.receiptHash = this.hashReceipt(receipt);
    await this.receipts.save(receipt);
    participant.version += 1;
    await this.participants.save(participant);
    return this.receiptView(receipt);
  }

  async withdraw(
    tenantId: string,
    sessionId: string,
    dto: WithdrawChoicesDto,
  ): Promise<ConsentReceipt> {
    const { participant, offer } = await this.findSession(tenantId, sessionId);
    if (participant.version !== dto.version) {
      throw new ConflictException('This session changed since you last loaded it.');
    }
    if (participant.version === 0) {
      throw new BadRequestException('No choices have been recorded yet for this session.');
    }
    const previous = await this.lastReceipt(tenantId, sessionId);
    const receipt = this.receipts.create({
      tenantId,
      sessionId,
      syntheticReference: participant.syntheticReference,
      offer: this.offerView(offer),
      version: participant.version + 1,
      kind: 'choices_withdrawn',
      choices: dto.purposeIds.map((purposeId) => ({ purposeId, decision: 'decline' as const })),
      interfaceLanguage: dto.interfaceLanguage,
      previousReceiptHash: previous?.receiptHash ?? null,
      receiptHash: '',
    });
    receipt.receiptHash = this.hashReceipt(receipt);
    await this.receipts.save(receipt);
    participant.version += 1;
    await this.participants.save(participant);
    return this.receiptView(receipt);
  }

  private async lastReceipt(
    tenantId: string,
    sessionId: string,
  ): Promise<ConsentReceiptEntity | null> {
    return this.receipts.findOne({ where: { tenantId, sessionId }, order: { occurredAt: 'DESC' } });
  }

  private hashReceipt(receipt: ConsentReceiptEntity): string {
    const canonical = JSON.stringify({
      previous: receipt.previousReceiptHash,
      sessionId: receipt.sessionId,
      version: receipt.version,
      kind: receipt.kind,
      choices: receipt.choices,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private async findSession(
    tenantId: string,
    id: string,
  ): Promise<{ participant: ConsentParticipantEntity; offer: ConsentOfferEntity }> {
    const participant = await this.participants.findOne({ where: { id, tenantId } });
    if (!participant) throw new NotFoundException('Consent session not found.');
    const offer = await this.offers.findOne({ where: { id: participant.offerId, tenantId } });
    if (!offer) throw new NotFoundException('Consent offer not found.');
    return { participant, offer };
  }

  private offerView(row: ConsentOfferEntity): ConsentOffer {
    return {
      id: row.id,
      version: row.version,
      catalogHash: row.catalogHash,
      createdAt: row.createdAt.toISOString(),
      notice: row.notice,
      purposes: row.purposes,
    };
  }

  private participantView(
    row: ConsentParticipantEntity,
    offer: ConsentOfferEntity,
    receipts: ConsentReceiptEntity[],
  ): ConsentParticipant {
    return {
      id: row.id,
      offer: this.offerView(offer),
      syntheticReference: row.syntheticReference,
      expiresAt: row.expiresAt.toISOString(),
      version: row.version,
      receipts: receipts.map((receipt) => this.receiptView(receipt)),
    };
  }

  private receiptView(row: ConsentReceiptEntity): ConsentReceipt {
    return {
      id: row.id,
      sessionId: row.sessionId,
      syntheticReference: row.syntheticReference,
      offer: row.offer,
      version: row.version,
      kind: row.kind,
      choices: row.choices,
      interfaceLanguage: row.interfaceLanguage,
      occurredAt: row.occurredAt.toISOString(),
      previousReceiptHash: row.previousReceiptHash,
      receiptHash: row.receiptHash,
      mode: row.mode,
      assurance: row.assurance,
      legalReviewStatus: row.legalReviewStatus,
      contactVerification: row.contactVerification,
      deletionStatus: row.deletionStatus,
    };
  }
}
