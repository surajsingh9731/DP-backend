import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
import type { FollowupTask, TaskEvidenceReview } from '@sahmati/contracts';
import { evidenceCheckFreshness } from './check-evidence.mapping.js';
@Injectable()
export class CheckReviewEvidenceSource implements EvidenceSource {
  readonly kind = 'check_review' as const;
  readonly sql = eventSql(
    this.kind,
    `t.id::text AS id,t.id::text AS "sourceId",e.version,(e.data->>'reviewedAt')::timestamptz AS at,'manual_review'::text AS action,e.data->>'result' AS status,'manual'::text AS provenance,t.version AS source_version,e.data,t.data AS current_data`,
    'workspace.check_reviews e JOIN workspace.followup_tasks t ON t.tenant_id=e.tenant_id AND t.id=e.task_id',
    `t.tenant_id=$1::uuid AND t.branch_id=$2::uuid AND ($4::boolean OR t.assignee_id=$3::uuid)`,
  );
  async detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    const row = await evidenceRecord<TaskEvidenceReview>(client, scope, this, id, version),
      draft = evidenceDraft(row, `/workspace/${scope.tenantId}/checks/${row.sourceId}`);
    draft.detail.freshness = evidenceCheckFreshness(row.current_data as FollowupTask, row.data);
    draft.detail.validUntil = row.data.validUntil;
    draft.detail.facts.push({ label: 'result', value: row.data.result });
    return draft;
  }
}
