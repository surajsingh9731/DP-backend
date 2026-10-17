import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
@Injectable()
export class NoticeEvidenceSource implements EvidenceSource {
  readonly kind = 'notice' as const;
  readonly sql = eventSql(
    this.kind,
    `n.id::text AS id,n.id::text AS "sourceId",1 AS version,n.submitted_at AS at,'snapshot_saved'::text AS action,'saved'::text AS status,'recorded'::text AS provenance,1 AS source_version,jsonb_build_object('entryVersion',n.entry_version,'language',n.language) AS data`,
    `workspace.notice_snapshots n`,
    `n.tenant_id=$1::uuid AND n.branch_id=$2::uuid AND ($4::boolean OR $3::uuid IS NOT NULL)`,
  );
  async detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    const row = await evidenceRecord<{ entryVersion: number; language: string }>(
        client,
        scope,
        this,
        id,
        version,
      ),
      draft = evidenceDraft(row);
    const review = await client.query(
      'SELECT notice_id FROM workspace.notice_reviews WHERE tenant_id=$1 AND notice_id=$2',
      [scope.tenantId, row.sourceId],
    );
    draft.detail.links.push(
      review.rows.length
        ? {
            label: 'source',
            state: 'available',
            path: `/workspace/${scope.tenantId}/notices/${row.sourceId}`,
          }
        : { label: 'source', state: 'unavailable' },
    );
    draft.detail.facts.push(
      { label: 'recordVersion', value: row.data.entryVersion },
      { label: 'language', value: row.data.language },
    );
    return draft;
  }
}
