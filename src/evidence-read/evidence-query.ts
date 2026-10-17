import { NotFoundException } from '@nestjs/common';
import type { TenantScope, EvidenceItem } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type {
  EvidenceSource,
  EvidenceRecord,
  EvidenceWindow,
  EvidenceListQuery,
} from './evidence-source.js';
import { evidenceItem } from './evidence-source.js';
function scopedParams(scope: TenantScope) {
  return [scope.tenantId, scope.branchId, scope.userId, scope.role === 'owner'];
}
export async function evidenceRows(
  client: DatabaseClient,
  scope: TenantScope,
  source: EvidenceSource,
  query: EvidenceListQuery,
  window: EvidenceWindow,
): Promise<EvidenceItem[]> {
  if (query.kind && query.kind !== source.kind) return [];
  const result = await client.query<EvidenceItem>(
    `SELECT kind,id,"sourceId",version,at,action,status,provenance,key FROM (${source.sql}) scoped WHERE at<=$5::timestamptz AND ($6::timestamptz IS NULL OR at<$6 OR (at=$6 AND key COLLATE "C">$7)) AND ($8='' OR position(lower($8) in lower(kind||' '||id||' '||"sourceId"||' '||action||' '||status))>0) AND ($9='' OR provenance=$9) ORDER BY at DESC,key COLLATE "C" ASC LIMIT $10`,
    [
      ...scopedParams(scope),
      window.asOf,
      window.beforeAt,
      window.beforeKey,
      query.q ?? '',
      query.provenance ?? '',
      query.limit + 1,
    ],
  );
  return result.rows.map(evidenceItem);
}
export async function evidenceRecord<T>(
  client: DatabaseClient,
  scope: TenantScope,
  source: Pick<EvidenceSource, 'sql'>,
  id: string,
  version: number,
): Promise<EvidenceRecord<T>> {
  const result = await client.query<EvidenceRecord<T>>(
    `SELECT * FROM (${source.sql}) scoped WHERE id=$5 AND version=$6`,
    [...scopedParams(scope), id, version],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundException('Evidence unavailable in this scope.');
  return row;
}
export function eventSql(kind: string, select: string, from: string, where: string) {
  return `SELECT '${kind}'::text AS kind,base.id,base."sourceId",base.version,date_trunc('milliseconds',base.at) AS at,base.action,base.status,base.provenance,base.source_version,base.data,to_jsonb(base)->'current_data' AS current_data, '${kind}:'||base.id||':'||base.version AS key FROM (SELECT ${select} FROM ${from} WHERE ${where}) base`;
}
