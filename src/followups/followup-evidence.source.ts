import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
import type { FollowupEvent } from '@sahmati/contracts';
import { eventIntegrity } from '../evidence-read/evidence-integrity.js';
@Injectable()
export class FollowupEvidenceSource implements EvidenceSource {
  readonly kind = 'followup' as const;
  readonly sql = eventSql(
    this.kind,
    `t.id::text AS id,t.id::text AS "sourceId",e.version,(e.data->>'occurredAt')::timestamptz AS at,e.data->>'action' AS action,e.data->'task'->>'status' AS status,CASE WHEN e.data->>'action'='created' THEN 'recorded' ELSE 'manual' END AS provenance,t.version AS source_version,e.data`,
    'workspace.followup_events e JOIN workspace.followup_tasks t ON t.tenant_id=e.tenant_id AND t.id=e.task_id',
    `t.tenant_id=$1::uuid AND t.branch_id=$2::uuid AND ($4::boolean OR t.assignee_id=$3::uuid)`,
  );
  async detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    const row = await evidenceRecord<FollowupEvent>(client, scope, this, id, version),
      draft = evidenceDraft(row, `/workspace/${scope.tenantId}/followups/${id}`);
    const prior =
      version > 1
        ? (
            await client.query<{ data: FollowupEvent }>(
              'SELECT data FROM workspace.followup_events WHERE tenant_id=$1 AND task_id=$2 AND version=$3',
              [scope.tenantId, id, version - 1],
            )
          ).rows[0]?.data
        : undefined;
    draft.detail.integrity = eventIntegrity(row.data, prior);
    if (version > 1)
      draft.related.push({ label: 'previous', kind: this.kind, id, version: version - 1 });
    draft.detail.facts.push({ label: 'coverage', value: row.data.task.location.mapping });
    draft.related.push({ label: 'notice', kind: 'notice', id: row.data.task.noticeId, version: 1 });
    const receipt = await client.query<{ version: number }>(
      'SELECT version FROM workspace.consent_receipts WHERE tenant_id=$1 AND branch_id=$2 AND id=$3',
      [scope.tenantId, scope.branchId, row.data.task.receiptId],
    );
    if (receipt.rows[0])
      draft.related.push({
        label: 'withdrawal',
        kind: 'withdrawal',
        id: row.data.task.receiptId,
        version: receipt.rows[0].version,
      });
    else draft.detail.links.push({ label: 'withdrawal', state: 'unavailable' });
    return draft;
  }
}
