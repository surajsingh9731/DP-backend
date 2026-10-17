import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FollowupTask, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { NoticeSnapshotEntity } from '../notices/entities/notice-snapshots.entity.js';
import { ConsentReceiptEntity } from '../consent-sandbox/entities/consent-receipt.entity.js';
import { FollowupsRepository } from './followups.repository.js';
import { followupLocations } from './followup-locations.js';
import { FollowupHistoryService } from './followup-history.service.js';
@Injectable()
export class FollowupCreationService {
  constructor(
    private readonly repository: FollowupsRepository,
    private readonly history: FollowupHistoryService,
  ) {}
  /** Caller owns the membership-authorized tenant transaction. Does not contact a vendor or enqueue a message. */
  async ensure(
    client: DatabaseClient,
    scope: TenantScope,
    receiptId: string,
  ): Promise<FollowupTask[]> {
    await this.repository.lockReceipt(client, scope, receiptId);
    // Creation lookup is branch-wide even when the withdrawer is staff; assignment does not determine deduplication.
    const receipt = await client.manager
      .getRepository(ConsentReceiptEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: receiptId });
    if (!receipt || receipt.data.kind !== 'choices_withdrawn')
      throw new ConflictException('A synthetic withdrawal receipt is required.');
    const prior = await client.manager.getRepository(ConsentReceiptEntity).findOneBy({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      sessionId: receipt.sessionId,
      version: receipt.version - 1,
    });
    const notice = await client.manager.getRepository(NoticeSnapshotEntity).findOneBy({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: receipt.data.offer.notice.id,
    });
    if (
      !prior ||
      prior.data.receiptHash !== receipt.data.previousReceiptHash ||
      !notice ||
      notice.entryVersion !== receipt.data.offer.notice.entryVersion
    )
      throw new ConflictException('Immutable withdrawal source linkage is unavailable.');
    const existing = await this.repository.list(client, { ...scope, role: 'owner' }, receiptId);
    if (existing.length) return existing.map((row) => row.data);
    const withdrawnPurposeIds = receipt.data.choices
      .filter(
        (c) =>
          c.decision === 'decline' &&
          prior.data.choices.some((p) => p.purposeId === c.purposeId && p.decision === 'allow'),
      )
      .map((c) => c.purposeId);
    if (!withdrawnPurposeIds.length)
      throw new ConflictException('Receipt has no newly withdrawn purposes.');
    const tasks: FollowupTask[] = [];
    for (const location of followupLocations(notice.registerData)) {
      const task: FollowupTask = {
        id: randomUUID(),
        receiptId,
        receiptHash: receipt.data.receiptHash,
        sessionId: receipt.sessionId,
        noticeId: notice.id,
        entryVersion: notice.entryVersion,
        withdrawnPurposeIds,
        location,
        status: location.mapping === 'unknown' ? 'unknown' : 'pending',
        version: 1,
        responsibleRole: 'owner',
        assignee: null,
        declaredBy: null,
        declaredEvidence: [],
        retentionNote: notice.registerData.retentionNote,
        updatedAt: new Date().toISOString(),
        mode: 'local-sample',
        applicability: 'unreviewed-candidate',
      };
      await this.repository.insert(client, scope, task);
      await this.history.append(
        client,
        scope,
        task,
        'created',
        'Candidate location from the immutable notice/register snapshot; applicability and evidence remain unreviewed.',
        [],
        null,
      );
      tasks.push(task);
    }
    return tasks;
  }
}
