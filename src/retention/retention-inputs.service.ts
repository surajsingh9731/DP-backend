import { ConflictException, Injectable } from '@nestjs/common';
import type {
  TenantScope,
  RetentionInputs,
  RetentionPolicy,
  RetentionHold,
  ConsentReceipt,
  RegisterData,
  RightsRequest,
  FollowupTask,
  RetentionContextView,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RetentionRepository } from './retention.repository.js';
import { RETENTION_LIMITS } from '../constants/retention.constants.js';
import { followupLocations, mappedFollowupLocations } from '../followups/followup-locations.js';
@Injectable()
export class RetentionInputsService {
  constructor(private readonly repository: RetentionRepository) {}
  private bounded<T>(rows: T[], limit: number): T[] {
    if (rows.length > limit)
      throw new ConflictException(
        'Synthetic input scope exceeds this bounded preview. No partial decision is available.',
      );
    return rows;
  }
  async load(
    client: DatabaseClient,
    scope: TenantScope,
    entryId: string,
  ): Promise<RetentionInputs> {
    const entry = await this.repository.entry(client, scope, entryId),
      policies = this.bounded(
        await this.repository.list(client, scope, 'policy', entryId, RETENTION_LIMITS.policies),
        RETENTION_LIMITS.policies,
      ).map((row) => row.data as RetentionPolicy),
      holds = this.bounded(
        await this.repository.list(client, scope, 'hold', entryId, RETENTION_LIMITS.holds),
        RETENTION_LIMITS.holds,
      ).map((row) => row.data as RetentionHold);
    const receipts = this.bounded(
      (
        await client.query<{ data: ConsentReceipt; register_data: RegisterData }>(
          `SELECT DISTINCT ON (r.session_id) r.data,n.register_data FROM workspace.consent_receipts r JOIN workspace.notice_snapshots n ON n.tenant_id=r.tenant_id AND n.id::text=r.data->'offer'->'notice'->>'id' WHERE r.tenant_id=$1 AND r.branch_id=$2 AND n.branch_id=$2 AND n.entry_id=$3 ORDER BY r.session_id,r.version DESC,r.id LIMIT $4`,
          [scope.tenantId, scope.branchId, entryId, RETENTION_LIMITS.records + 1],
        )
      ).rows,
      RETENTION_LIMITS.records,
    );
    if (
      receipts.some(
        (row) =>
          row.data.mode !== 'local-sample' || row.data.assurance !== 'unverified-synthetic-adult',
      )
    )
      throw new ConflictException('Only generated local sample records are supported.');
    const rights = this.bounded(
      (
        await client.query<{ data: RightsRequest }>(
          `SELECT r.data FROM workspace.rights_requests r JOIN workspace.notice_snapshots n ON n.tenant_id=r.tenant_id AND n.id::text=r.data->'source'->>'noticeId' WHERE r.tenant_id=$1 AND r.branch_id=$2 AND n.branch_id=$2 AND n.entry_id=$3 ORDER BY r.id LIMIT $4`,
          [scope.tenantId, scope.branchId, entryId, RETENTION_LIMITS.related + 1],
        )
      ).rows.map((r) => r.data),
      RETENTION_LIMITS.related,
    );
    const tasks = this.bounded(
      (
        await client.query<{ data: FollowupTask }>(
          `SELECT t.data FROM workspace.followup_tasks t JOIN workspace.notice_snapshots n ON n.tenant_id=t.tenant_id AND n.id::text=t.data->>'noticeId' WHERE t.tenant_id=$1 AND t.branch_id=$2 AND n.branch_id=$2 AND n.entry_id=$3 ORDER BY t.id LIMIT $4`,
          [scope.tenantId, scope.branchId, entryId, RETENTION_LIMITS.related + 1],
        )
      ).rows.map((r) => r.data),
      RETENTION_LIMITS.related,
    );
    const locations = followupLocations(entry.data);
    const sources: RetentionInputs['receipts'] = receipts.map((row) => ({
      sampleRecordId: row.data.sessionId,
      receipt: {
        id: row.data.id,
        sessionId: row.data.sessionId,
        version: row.data.version,
        kind: row.data.kind,
        occurredAt: row.data.occurredAt,
        receiptHash: row.data.receiptHash,
        notice: { id: row.data.offer.notice.id, entryVersion: row.data.offer.notice.entryVersion },
      },
      locations: mappedFollowupLocations(
        row.register_data,
        tasks.filter((task) => task.sessionId === row.data.sessionId),
      ),
    }));
    for (const request of rights)
      if (!sources.some((row) => row.sampleRecordId === request.sessionId))
        sources.push({ sampleRecordId: request.sessionId, receipt: null, locations });
    this.bounded(sources, RETENTION_LIMITS.records);
    return {
      entry: { id: entry.id, version: entry.version, locations },
      policies: policies.map(({ id, version, entryVersion, durationDays, status }) => ({
        id,
        version,
        entryVersion,
        durationDays,
        status,
      })),
      holds: holds.map(({ id, version, scope, target, status }) => ({
        id,
        version,
        scope,
        target,
        status,
      })),
      receipts: sources.sort((a, b) =>
        (a.sampleRecordId ?? '').localeCompare(b.sampleRecordId ?? ''),
      ),
      rights: rights.map((row) => ({
        id: row.id,
        version: row.version,
        sessionId: row.sessionId,
        status: row.status,
        unresolvedCount: row.workItems.filter((item) => item.status !== 'independently_reviewed')
          .length,
      })),
      followups: tasks.map(({ id, version, sessionId, status }) => ({
        id,
        version,
        sessionId,
        status,
      })),
    };
  }
  view(inputs: RetentionInputs): RetentionContextView {
    const locations = new Map(inputs.entry.locations.map((location) => [location.key, location]));
    for (const source of inputs.receipts)
      for (const location of source.locations) locations.set(location.key, location);
    return {
      entryId: inputs.entry.id,
      entryVersion: inputs.entry.version,
      sampleRecords: inputs.receipts
        .filter((row) => row.sampleRecordId !== null)
        .map((row) => ({
          id: row.sampleRecordId!,
          receiptId: row.receipt?.id ?? null,
          referenceAt: row.receipt?.occurredAt ?? null,
        })),
      locations: [...locations.values()],
      coverage: 'bounded-synthetic-sources',
    };
  }
}
