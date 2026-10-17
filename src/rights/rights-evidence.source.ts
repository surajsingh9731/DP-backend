import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
import type { RightsEvent } from '@sahmati/contracts';
import { eventIntegrity } from '../evidence-read/evidence-integrity.js';
@Injectable()
export class RightsEvidenceSource implements EvidenceSource {
  readonly kind = 'rights' as const;
  readonly sql = eventSql(
    this.kind,
    `t.id::text AS id,t.id::text AS "sourceId",e.version,(e.data->>'at')::timestamptz AS at,e.data->>'action' AS action,e.data->'request'->>'status' AS status,CASE WHEN e.data->>'action'='submitted' THEN 'recorded' ELSE 'manual' END AS provenance,t.version AS source_version,e.data`,
    'workspace.rights_events e JOIN workspace.rights_requests t ON t.tenant_id=e.tenant_id AND t.id=e.request_id',
    `t.tenant_id=$1::uuid AND t.branch_id=$2::uuid AND ($4::boolean OR t.assignee_id=$3::uuid)`,
  );
  async detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    const row = await evidenceRecord<RightsEvent>(client, scope, this, id, version),
      draft = evidenceDraft(row, `/workspace/${scope.tenantId}/rights/${id}`);
    const prior =
      version > 1
        ? (
            await client.query<{ data: RightsEvent }>(
              'SELECT data FROM workspace.rights_events WHERE tenant_id=$1 AND request_id=$2 AND version=$3',
              [scope.tenantId, id, version - 1],
            )
          ).rows[0]?.data
        : undefined;
    draft.detail.integrity = eventIntegrity(row.data, prior);
    if (version > 1)
      draft.related.push({ label: 'previous', kind: this.kind, id, version: version - 1 });
    draft.detail.facts.push({
      label: 'remaining',
      value: row.data.request.workItems.filter((item) => item.status !== 'independently_reviewed')
        .length,
    });
    draft.related.push({
      label: 'notice',
      kind: 'notice',
      id: row.data.request.source.noticeId,
      version: 1,
    });
    return draft;
  }
}
