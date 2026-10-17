export interface ConsentPurpose {
  id: string;
  labelEn: string;
  labelHi: string;
}
export interface ConsentNotice {
  id: string;
  entryVersion: number;
  language: 'en' | 'hi';
  title: string;
  body: string;
  warning: string;
}
export interface ConsentOffer {
  id: string;
  version: number;
  catalogHash: string;
  notice: ConsentNotice;
  purposes: ConsentPurpose[];
  createdAt: string;
}
export interface ConsentChoice {
  purposeId: string;
  decision: 'allow' | 'decline';
}
export interface ConsentReceipt {
  id: string;
  sessionId: string;
  syntheticReference: string;
  offer: ConsentOffer;
  version: number;
  kind: 'choices_recorded' | 'choices_withdrawn';
  choices: ConsentChoice[];
  interfaceLanguage: 'en' | 'hi';
  occurredAt: string;
  previousReceiptHash: string | null;
  receiptHash: string;
  mode: 'local-sample';
  assurance: 'unverified-synthetic-adult';
  legalReviewStatus: 'unreviewed';
  contactVerification: 'unverified';
  deletionStatus: 'not-performed';
}
export interface ConsentParticipant {
  id: string;
  offer: ConsentOffer;
  syntheticReference: string;
  expiresAt: string;
  version: number;
  receipts: ConsentReceipt[];
}
export interface CreateConsentOffer {
  noticeId: string;
  purposes: ConsentPurpose[];
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface SubmitConsentChoices {
  offerId: string;
  offerVersion: number;
  catalogHash: string;
  interfaceLanguage: 'en' | 'hi';
  choices: ConsentChoice[];
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface WithdrawConsentChoices {
  version: number;
  purposeIds: string[];
  interfaceLanguage: 'en' | 'hi';
  idempotencyKey: string;
}
