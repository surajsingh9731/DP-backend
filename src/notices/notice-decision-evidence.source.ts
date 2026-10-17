import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
@Injectable()
export class NoticeDecisionEvidenceSource implements EvidenceSource {
  readonly kind = 'notice_decision' as const;
  readonly sql = eventSql(
    this.kind,
    `d.id::text AS id,n.id::text AS "sourceId",d.version AS version,d.decided_at AS at,d.decision AS action,d.decision AS status,'manual'::text AS provenance,coalesce((SELECT max(v.version) FROM workspace.notice_decisions v WHERE v.tenant_id=n.tenant_id AND v.notice_id=n.id),d.version) AS source_version,jsonb_build_object('entryVersion',n.entry_version,'language',n.language) AS data`,
    `workspace.notice_decisions d JOIN workspace.notice_snapshots n ON n.tenant_id=d.tenant_id AND n.id=d.notice_id`,
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
