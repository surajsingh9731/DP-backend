import { ConflictException, Injectable } from '@nestjs/common';
import type { ConsentOffer, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { NoticeSnapshotEntity, NoticeReviewEntity } from '../notices/entities/index.js';
import { RegisterEntryEntity } from '../database/entities/register-entries.entity.js';
import { PreparationSelectionService } from '../preparation/preparation-selection.service.js';
import { ConsentRepository } from './consent.repository.js';
@Injectable()
export class ConsentSourceService {
  constructor(
    private readonly preparation: PreparationSelectionService,
    private readonly repository: ConsentRepository,
  ) {}
  async notice(client: DatabaseClient, scope: TenantScope, noticeId: string) {
    const notice = await client.manager
      .getRepository(NoticeSnapshotEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: noticeId });
    const review = await client.manager
      .getRepository(NoticeReviewEntity)
      .findOneBy({ tenantId: scope.tenantId, noticeId });
    if (!notice || !notice.preparationSource || review?.status !== 'sample_published')
      throw new ConflictException('Select an internally prepared, sample-published notice.');
    const entry = await client.manager.getRepository(RegisterEntryEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id: notice.entryId },
      lock: { mode: 'pessimistic_write' },
    });
    if (entry?.version !== notice.entryVersion)
      throw new ConflictException('Register changed. Prepare a current notice.');
    await this.preparation.resolve(
      client,
      scope,
      notice.preparationSource,
      notice.language,
      notice.sourcePack ?? undefined,
    );
    return {
      id: notice.id,
      entryVersion: notice.entryVersion,
      language: notice.language,
      title: notice.preview.title,
      body: notice.preview.body,
      warning: notice.preview.warning,
    };
  }
  async current(client: DatabaseClient, scope: TenantScope, offer: ConsentOffer) {
    if ((await this.repository.latest(client, scope, offer.notice.id))?.id !== offer.id)
      throw new ConflictException('A newer purpose catalog exists. Start a new synthetic session.');
    await this.notice(client, scope, offer.notice.id);
  }
}
