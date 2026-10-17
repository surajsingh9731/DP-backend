import { PreparationSelectionService } from '../preparation/preparation-selection.service.js';
import { PREPARATION_EN } from '../preparation/locales/en.js';
import { PREPARATION_HI } from '../preparation/locales/hi.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { TenantScope, NoticeSnapshotView, SourcePack } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
import {
  NOTICE_STATUS,
  NOTICE_MODE,
  NOTICE_LEGAL_REVIEW_STATUS,
  NOTICE_SUBMIT_ROLES,
  NOTICE_REVIEW_ROLE,
} from '../constants/notices.constants.js';
import { renderNoticePreview } from '../register/notice-preview.renderer.js';
import { NoticesRepository } from './notices.repository.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { NoticeDecisionDto } from './dto/notice-decision.dto.js';
import { noticeView } from './notice.mapper.js';
@Injectable()
export class NoticesService {
  constructor(
    private readonly db: Database,
    private readonly repository: NoticesRepository,
    private readonly authorization: TenantAuthorizationService,
    private readonly preparation: PreparationSelectionService,
  ) {}
  private async current(client: DatabaseClient, scope: TenantScope, id: string) {
    const snapshot = await this.repository.snapshot(client, scope, id);
    if (!snapshot) throw new NotFoundException('Notice is unavailable.');
    const review = await this.repository.review(client, scope, id);
    if (!review) throw new NotFoundException('Notice review is unavailable.');
    return noticeView(snapshot, review, await this.repository.decisions(client, scope, [id]));
  }
  private async replay(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await this.repository.lockCommand(client, scope, key);
    const hash = createHash(SECURITY_HASH_ALGORITHM).update(JSON.stringify(payload)).digest('hex');
    const prior = await this.repository.command(client, scope, key);
    if (prior && prior.payloadHash !== hash)
      throw new ConflictException('Idempotency key was already used for a different request.');
    return { hash, response: prior?.response };
  }
  list(scope: TenantScope): Promise<NoticeSnapshotView[]> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const snapshots = await this.repository.snapshots(client, scope);
      if (!snapshots.length) return [];
      const ids = snapshots.map((row) => row.id),
        reviews = await this.repository.reviews(client, scope, ids),
        decisions = await this.repository.decisions(client, scope, ids);
      return snapshots.map((snapshot) =>
        noticeView(
          snapshot,
          reviews.find((row) => row.noticeId === snapshot.id)!,
          decisions.filter((row) => row.noticeId === snapshot.id),
        ),
      );
    });
  }
  detail(scope: TenantScope, id: string) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return this.current(client, scope, id);
    });
  }
  create(scope: TenantScope, dto: CreateNoticeDto): Promise<NoticeSnapshotView> {
    if (!NOTICE_SUBMIT_ROLES.includes(scope.role))
      throw new ForbiddenException('Only owners and staff can submit internal notices.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const prior = await this.replay(client, scope, dto.idempotencyKey, {
        operation: 'submit',
        actor: scope.userId,
        entryId: dto.entryId,
        entryVersion: dto.entryVersion,
        language: dto.language,
        ...(dto.preparation ? { preparation: dto.preparation } : {}),
      });
      if (prior.response) return prior.response;
      const entry = await this.repository.entry(client, scope, dto.entryId);
      if (!entry) throw new NotFoundException('Register entry is unavailable.');
      if (entry.version !== dto.entryVersion)
        throw new ConflictException('Register entry changed. Refresh before submitting.');
      const source = await this.repository.source(client, scope, entry.id);
      const sourcePack: SourcePack | null = source
        ? {
            id: source.packId,
            version: source.packVersion,
            reviewStatus: NOTICE_LEGAL_REVIEW_STATUS,
          }
        : null;
      const prepared = dto.preparation
        ? await this.preparation.resolve(
            client,
            scope,
            dto.preparation,
            dto.language,
            sourcePack ?? undefined,
          )
        : null;
      const preview = renderNoticePreview(
        prepared
          ? {
              ...entry.data,
              contact: `${prepared.contact.displayName} <${prepared.contact.email}>`,
            }
          : entry.data,
        entry.id,
        entry.version,
        dto.language,
        sourcePack ?? undefined,
      );
      if (prepared) {
        preview.title = prepared.template.title;
        preview.body = `${prepared.template.body}\n\n${preview.body}`;
        preview.warning +=
          ' ' +
          (dto.language === 'hi' ? PREPARATION_HI.contactWarning : PREPARATION_EN.contactWarning);
      }
      const id = randomUUID();
      await this.repository.insertSnapshot(client, {
        tenantId: scope.tenantId,
        id,
        branchId: scope.branchId,
        entryId: entry.id,
        entryVersion: entry.version,
        language: dto.language,
        mode: NOTICE_MODE,
        legalReviewStatus: NOTICE_LEGAL_REVIEW_STATUS,
        registerData: entry.data,
        sourcePack,
        preview,
        preparationSource: prepared?.source ?? null,
        submittedBy: scope.userId,
        submittedAt: new Date(),
      });
      await this.repository.insertReview(client, {
        tenantId: scope.tenantId,
        noticeId: id,
        version: 1,
        status: NOTICE_STATUS.inReview,
      });
      const response = await this.current(client, scope, id);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, prior.hash, response);
      return response;
    });
  }
  decide(scope: TenantScope, id: string, dto: NoticeDecisionDto): Promise<NoticeSnapshotView> {
    if (scope.role !== NOTICE_REVIEW_ROLE)
      throw new ForbiddenException('Only the workspace owner can record notice review decisions.');
    if (dto.decision === 'publish_sample' && dto.sampleOnlyAcknowledged !== true)
      throw new BadRequestException(
        'Acknowledge that publication is a local, legally unreviewed sample.',
      );
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const comment = dto.comment?.trim() || null;
      const prior = await this.replay(client, scope, dto.idempotencyKey, {
        operation: 'decide',
        actor: scope.userId,
        id,
        version: dto.version,
        decision: dto.decision,
        comment,
        sampleOnlyAcknowledged: dto.sampleOnlyAcknowledged === true,
      });
      if (prior.response) return prior.response;
      const snapshot = await this.repository.snapshot(client, scope, id);
      if (!snapshot) throw new NotFoundException('Notice is unavailable.');
      const review = await this.repository.review(client, scope, id, true);
      if (!review || review.version !== dto.version || review.status !== NOTICE_STATUS.inReview)
        throw new ConflictException('Notice review changed. Refresh before deciding.');
      if (dto.decision === 'publish_sample') {
        const entry = await this.repository.entry(client, scope, snapshot.entryId);
        if (!entry || entry.version !== snapshot.entryVersion)
          throw new ConflictException(
            'Source register entry changed. Submit a new snapshot before sample publication.',
          );
        if (snapshot.preparationSource)
          await this.preparation.resolve(
            client,
            scope,
            snapshot.preparationSource,
            snapshot.language,
            snapshot.sourcePack ?? undefined,
          );
      }
      const version = review.version + 1,
        status =
          dto.decision === 'publish_sample'
            ? NOTICE_STATUS.samplePublished
            : NOTICE_STATUS.changesRequested;
      await this.repository.updateReview(client, scope, id, version, status);
      await this.repository.insertDecision(
        client,
        scope,
        id,
        randomUUID(),
        version,
        dto.decision,
        comment,
      );
      const response = await this.current(client, scope, id);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, prior.hash, response);
      return response;
    });
  }
}
