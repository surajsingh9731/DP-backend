import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
import type { ConsentReceipt } from '@sahmati/contracts';
export function receiptEvidenceSql(kind: 'consent' | 'withdrawal') {
  return eventSql(
    kind,
    `r.id::text AS id,r.session_id::text AS "sourceId",r.version,r.occurred_at AS at,r.data->>'kind' AS action,r.data->>'kind' AS status,'recorded'::text AS provenance,p.version AS source_version,r.data`,
    'workspace.consent_receipts r JOIN workspace.consent_participants p ON p.tenant_id=r.tenant_id AND p.branch_id=r.branch_id AND p.id=r.session_id',
    `r.tenant_id=$1::uuid AND r.branch_id=$2::uuid AND ($4::boolean OR p.actor_id=$3::uuid) AND r.data->>'kind'='${kind === 'consent' ? 'choices_recorded' : 'choices_withdrawn'}'`,
  );
}
export async function receiptEvidenceDetail(
  source: Pick<EvidenceSource, 'sql'>,
  client: DatabaseClient,
  scope: TenantScope,
  id: string,
  version: number,
) {
  const row = await evidenceRecord<ConsentReceipt>(client, scope, source, id, version),
    draft = evidenceDraft(row);
  draft.detail.facts.push({ label: 'language', value: row.data.interfaceLanguage });
  draft.related.push({ label: 'notice', kind: 'notice', id: row.data.offer.notice.id, version: 1 });
  // Legacy receipt hashing uses original JSON serialization. No canonical round-trip digest claim.
  if (scope.role === 'owner')
    draft.detail.links.push({
      label: 'source',
      state: 'available',
      path: `/workspace/${scope.tenantId}/consent-sandbox`,
    });
  return draft;
}
