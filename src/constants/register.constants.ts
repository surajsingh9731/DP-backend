export const REGISTER_EDIT_ROLE = 'owner';
export const REGISTER_PREVIEW_LANGUAGES = ['en', 'hi'] as const;
export const REGISTER_LIMITS = {
  name: 120,
  purpose: 1000,
  categories: 20,
  category: 100,
  storage: 200,
  retention: 500,
  contact: 200,
  version: 999999,
  list: 100,
  references: 10,
  referenceName: 100,
  referenceDetail: 200,
} as const;

export const STORAGE_MEDIA = ['digital', 'paper'] as const;
