import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { evidenceDraft } from '../evidence-read/evidence-source.js';
import { evidenceRecord, eventSql } from '../evidence-read/evidence-query.js';
import type { FollowupTask, TaskEvidenceReview, CheckEvaluation } from '@sahmati/contracts';
import { evaluationIntegrity } from '../evidence-read/evidence-integrity.js';
import { evidenceCheckFreshness } from './check-evidence.mapping.js';
@Injectable()
export class CheckEvaluationEvidenceSource implements EvidenceSource {
  readonly kind = 'check_evaluation' as const;
  readonly sql = eventSql(
    this.kind,
    `e.id::text AS id,t.id::text AS "sourceId",1 AS version,e.computed_at AS at,'local_evaluation'::text AS action,'snapshot'::text AS status,'computed'::text AS provenance,t.version AS source_version,e.data,t.data AS current_data`,
    'workspace.check_evaluations e JOIN workspace.followup_tasks t ON t.tenant_id=e.tenant_id AND t.id=e.task_id',
    `t.tenant_id=$1::uuid AND t.branch_id=$2::uuid AND ($4::boolean OR t.assignee_id=$3::uuid)`,
  );
  async detail(client: DatabaseClient, scope: TenantScope, id: string, version: number) {
    const row = await evidenceRecord<CheckEvaluation>(client, scope, this, id, version),
      draft = evidenceDraft(row, `/workspace/${scope.tenantId}/checks/${row.sourceId}`);
    const latest = (
      await client.query<{ data: TaskEvidenceReview }>(
        'SELECT data FROM workspace.check_reviews WHERE tenant_id=$1 AND task_id=$2 ORDER BY version DESC LIMIT 1',
        [scope.tenantId, row.sourceId],
      )
    ).rows[0]?.data;
    draft.detail.freshness = evidenceCheckFreshness(
      row.current_data as FollowupTask,
      latest,
      row.data,
    );
    if (latest) draft.detail.validUntil = latest.validUntil;
    draft.detail.integrity = evaluationIntegrity(row.data);
    // Historical computed results stay in their source module; the hub never relabels stale manual evidence as a current pass.
    return draft;
  }
}
