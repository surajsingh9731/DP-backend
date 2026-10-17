import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RightsSource, RightsWorkItem, RightsKind, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { NoticeSnapshotEntity } from '../notices/entities/notice-snapshots.entity.js';
import { ConsentOfferEntity } from '../consent-sandbox/entities/consent-offer.entity.js';
import { ConsentReceiptEntity } from '../consent-sandbox/entities/consent-receipt.entity.js';
import { FollowupsRepository } from '../followups/followups.repository.js';
import { mappedFollowupLocations, followupDigest } from '../followups/followup-locations.js';
@Injectable()
export class RightsSourceService {
  constructor(private readonly followups: FollowupsRepository) {}
  async build(
    client: DatabaseClient,
    scope: TenantScope,
    sessionId: string,
    offerId: string,
    kind: RightsKind,
  ): Promise<{ source: RightsSource; workItems: RightsWorkItem[] }> {
    const offer = await client.manager
      .getRepository(ConsentOfferEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: offerId });
    const notice = offer
      ? await client.manager
          .getRepository(NoticeSnapshotEntity)
          .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: offer.noticeId })
      : null;
    if (!offer || !notice) throw new ConflictException('Saved sample notice source unavailable.');
    const receipt = await client.manager.getRepository(ConsentReceiptEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, sessionId },
      order: { version: 'DESC' },
    });
    const related =
      receipt?.data.kind === 'choices_withdrawn'
        ? await this.followups.list(client, { ...scope, role: 'owner' }, receipt.id)
        : [];
    const locations =
      kind === 'grievance'
        ? [
            {
              key: followupDigest({ kind: 'grievance-review', noticeId: notice.id }),
              kind: 'primary' as const,
              name: 'Synthetic grievance review',
              detail: 'Review the synthetic case; no legal outcome implied.',
              mapping: 'declared' as const,
            },
          ]
        : mappedFollowupLocations(
            notice.registerData,
            related.map((row) => row.data),
          );
    return {
      source: {
        noticeId: notice.id,
        entryVersion: notice.entryVersion,
        noticeLanguage: notice.language,
        noticeTitle: notice.preview.title,
        offerId,
        sourceReceiptId: receipt?.id ?? null,
      },
      workItems: locations.map((location) => {
        const linked = related.find((row) => row.locationKey === location.key);
        return {
          id: randomUUID(),
          version: 1,
          location,
          status: location.mapping === 'unknown' ? 'unknown' : 'pending',
          declaredBy: null,
          declaredEvidence: [],
          ...(linked
            ? { relatedFollowupTaskId: linked.id, relatedFollowupTaskVersion: linked.version }
            : {}),
        };
      }),
    };
  }
}
