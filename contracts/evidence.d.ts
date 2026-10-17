export type EvidenceKind =
  | 'notice'
  | 'notice_decision'
  | 'consent'
  | 'withdrawal'
  | 'followup'
  | 'check_review'
  | 'check_evaluation'
  | 'rights';
export type EvidenceProvenance = 'recorded' | 'manual' | 'computed';
export interface EvidenceItem {
  key: string;
  kind: EvidenceKind;
  id: string;
  sourceId: string;
  version: number;
  at: string;
  action: string;
  status: string;
  provenance: EvidenceProvenance;
}
export interface EvidencePage {
  items: EvidenceItem[];
  nextCursor: string | null;
  asOf: string;
  serverTime: string;
  searchScope: 'identifiers-and-controlled-metadata';
}
export interface EvidenceFilters {
  kind?: EvidenceKind;
  provenance?: EvidenceProvenance;
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface EvidenceLink {
  label: 'notice' | 'withdrawal' | 'previous' | 'source';
  state: 'available' | 'unavailable';
  path?: string;
}
export interface EvidenceDetail {
  item: EvidenceItem;
  freshness:
    | 'historical'
    | 'source_changed'
    | 'current'
    | 'expired'
    | 'task_changed'
    | 'review_changed'
    | 'missing'
    | 'unknown';
  validUntil?: string;
  integrity: {
    digest: 'match' | 'mismatch' | 'not_checked';
    previous: 'linked' | 'mismatch' | 'unavailable' | 'not_applicable' | 'not_checked';
    scope: 'single-event-and-previous-reference' | 'single-snapshot' | 'not-checked';
  };
  facts: {
    label: 'sourceVersion' | 'recordVersion' | 'result' | 'remaining' | 'coverage' | 'language';
    value: string | number;
  }[];
  links: EvidenceLink[];
  serverTime: string;
  mode: 'local-sample';
}
