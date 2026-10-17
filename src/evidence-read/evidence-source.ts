import type {
  EvidenceKind,
  EvidenceItem,
  EvidenceDetail,
  TenantScope,
  EvidenceFilters,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
export interface EvidenceWindow {
  asOf: string;
  beforeAt: string | null;
  beforeKey: string | null;
}
export interface EvidenceRecord<T = unknown> extends EvidenceItem {
  data: T;
  source_version: number;
  notice_id?: string;
  receipt_id?: string;
  current_data?: unknown;
}
export interface EvidenceCandidate {
  label: 'notice' | 'withdrawal' | 'previous';
  kind: EvidenceKind;
  id: string;
  version: number;
}
export interface EvidenceDraft {
  detail: EvidenceDetail;
  related: EvidenceCandidate[];
}
export interface EvidenceSource {
  kind: EvidenceKind;
  sql: string;
  detail(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    version: number,
  ): Promise<EvidenceDraft>;
}
export function evidenceItem(row: EvidenceItem): EvidenceItem {
  return {
    key: row.key,
    kind: row.kind,
    id: row.id,
    sourceId: row.sourceId,
    version: row.version,
    at: new Date(row.at).toISOString(),
    action: row.action,
    status: row.status,
    provenance: row.provenance,
  };
}
export function evidenceDraft(row: EvidenceRecord, sourcePath?: string): EvidenceDraft {
  return {
    detail: {
      item: evidenceItem(row),
      freshness: row.version === row.source_version ? 'historical' : 'source_changed',
      integrity: { digest: 'not_checked', previous: 'not_checked', scope: 'not-checked' },
      facts: [{ label: 'sourceVersion', value: row.source_version }],
      links: sourcePath ? [{ label: 'source', state: 'available', path: sourcePath }] : [],
      serverTime: new Date().toISOString(),
      mode: 'local-sample',
    },
    related: [],
  };
}
export interface EvidenceListQuery extends EvidenceFilters {
  limit: number;
}
