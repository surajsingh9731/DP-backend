import { Injectable } from '@nestjs/common';
import type { LocalCheck, FollowupTask, TaskEvidenceReview, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { ConsentReceiptEntity } from '../consent-sandbox/entities/consent-receipt.entity.js';
import { NoticeSnapshotEntity } from '../notices/entities/notice-snapshots.entity.js';
import { ChecksRepository } from './checks.repository.js';
import { followupDigest } from '../followups/followup-locations.js';
import { CHECK_LIMITS } from '../constants/checks.constants.js';
import { reviewFreshness } from './checks.policy.js';
@Injectable()
export class LocalChecksService {
  constructor(private readonly repository: ChecksRepository) {}
  async compute(
    client: DatabaseClient,
    scope: TenantScope,
    task: FollowupTask,
    review: TaskEvidenceReview | undefined,
    now: Date,
  ): Promise<LocalCheck[]> {
    const receipt = await client.manager
      .getRepository(ConsentReceiptEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: task.receiptId });
    const notice = await client.manager
      .getRepository(NoticeSnapshotEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id: task.noticeId });
    const events = await this.repository.events(client, scope, task.id);
    const freshness = reviewFreshness(task, review, now),
      fresh = freshness === 'current';
    const historyComplete = events.length <= CHECK_LIMITS.events && events.length === task.version;
    const historyValid =
      historyComplete &&
      events.every((row, index) => {
        const { eventHash, ...data } = row.data;
        return (
          row.version === index + 1 &&
          followupDigest(data) === eventHash &&
          data.previousHash === (index ? events[index - 1]!.data.eventHash : null)
        );
      }) &&
      followupDigest(events.at(-1)?.data.task) === followupDigest(task);
    const linked =
      receipt && notice
        ? receipt.data.kind === 'choices_withdrawn' &&
          receipt.data.receiptHash === task.receiptHash &&
          receipt.data.offer.notice.id === notice.id &&
          notice.entryVersion === task.entryVersion
        : null;
    const manual = (
      id: LocalCheck['id'],
      result: LocalCheck['result'],
      reason: string,
    ): LocalCheck => ({
      id,
      result,
      reason,
      provenance: 'synthetic-manual-reference',
      freshness,
      references: fresh ? review!.evidenceRefs : [],
    });
    return [
      {
        id: 'receipt_link',
        result: linked === null ? 'unknown' : linked ? 'pass' : 'fail',
        reason:
          linked === null ? 'missing_source' : linked ? 'linked_local_records' : 'source_mismatch',
        provenance: 'local-record',
        freshness: 'current',
        references: [task.receiptId, task.noticeId],
      },
      {
        id: 'history_integrity',
        result: events.length > CHECK_LIMITS.events ? 'unknown' : historyValid ? 'pass' : 'fail',
        reason:
          events.length > CHECK_LIMITS.events
            ? 'history_limit'
            : historyValid
              ? 'hash_chain_matches'
              : 'history_mismatch',
        provenance: 'local-record',
        freshness: 'current',
        references: [task.id],
      },
      {
        id: 'location_reference',
        result: task.location.mapping === 'unknown' ? 'unknown' : 'pass',
        reason:
          task.location.mapping === 'unknown' ? 'unmapped_coverage' : 'declared_location_present',
        provenance: 'local-record',
        freshness: 'current',
        references: [task.location.key],
      },
      manual(
        'applicability_review',
        !fresh ? 'unknown' : review!.applicability === 'not_applicable' ? 'not_applicable' : 'pass',
        fresh ? 'owner_applicability_record' : freshness,
      ),
      manual(
        'manual_assessment',
        fresh ? review!.result : 'unknown',
        fresh ? 'manual_assessment_record' : freshness,
      ),
      {
        id: 'followup_state',
        result: ['unknown', 'retention_exception_declared'].includes(task.status)
          ? 'unknown'
          : task.status === 'independently_reviewed'
            ? 'pass'
            : 'fail',
        reason: task.status,
        provenance: 'local-record',
        freshness: 'current',
        references: [task.id],
      },
    ];
  }
}
