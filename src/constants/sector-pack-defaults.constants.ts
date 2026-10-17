import type { RegisterData } from '@sahmati/contracts';
import { SETUP_EN } from '../setup/locales/en.js';
import { SETUP_HI } from '../setup/locales/hi.js';
export const PACK_DEFAULTS: Record<string, RegisterData> = {
  'education-v1': {
    ...SETUP_EN.defaults,
    purposeHi: SETUP_HI.purposeHi,
    dataCategories: [...SETUP_EN.defaults.dataCategories],
  },
};
