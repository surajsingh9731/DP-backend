export interface SectorPackSetupQuestion {
  key: string;
  label: { en: string; hi: string };
  type: "boolean" | "text" | "number";
}

export interface SectorPackDataCategory {
  code: string;
  label: { en: string; hi: string };
  legalBasis: "consent" | "legitimate_use";
  defaultRetentionDays: number;
}

export interface SectorPackExemption {
  appliesTo: string;
  rule: string;
  note: { en: string; hi: string };
}

export interface SectorPack {
  code: string;
  version: number;
  label: { en: string; hi: string };
  setupQuestions: SectorPackSetupQuestion[];
  dataCategories: SectorPackDataCategory[];
  noticeClauses: { en: string; hi: string };
  exemptions: SectorPackExemption[];
  childHarmGuard: { blockedPurposes: string[] };
}
