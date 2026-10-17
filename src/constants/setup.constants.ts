export const SETUP_LIMITS = { organisationName: 120, version: 999999, packId: 60 } as const;
export const SETUP_STEPS = [1, 2, 3] as const;
export const SECTOR_PACK_REGISTRY = [
  { id: 'education', key: 'education', version: 1, available: true, defaultsId: 'education-v1' },
  { id: 'health', key: 'health', version: 1, available: false, defaultsId: null },
  { id: 'employer', key: 'employer', version: 1, available: false, defaultsId: null },
  {
    id: 'real-estate-recruitment',
    key: 'realEstateRecruitment',
    version: 1,
    available: false,
    defaultsId: null,
  },
  { id: 'retail-services', key: 'retailServices', version: 1, available: false, defaultsId: null },
  { id: 'hospitality', key: 'hospitality', version: 1, available: false, defaultsId: null },
  { id: 'events-exhibitions', key: 'events', version: 1, available: false, defaultsId: null },
  { id: 'housing-societies', key: 'housing', version: 1, available: false, defaultsId: null },
] as const;

export const SETUP_STATUS = { draft: 'draft', completed: 'completed' } as const;
export const SECTOR_PACK_STATUS = {
  sample: 'sample-draft',
  planned: 'planned-unreviewed',
} as const;
