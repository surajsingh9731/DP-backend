import { PACK_DEFAULTS } from '../constants/sector-pack-defaults.constants.js';
import type { SectorPackView } from '@sahmati/contracts';
import { SECTOR_PACK_REGISTRY, SECTOR_PACK_STATUS } from '../constants/setup.constants.js';
import { SETUP_EN } from './locales/en.js';
import { SETUP_HI } from './locales/hi.js';
export function sectorPacks(): SectorPackView[] {
  return SECTOR_PACK_REGISTRY.map((p) => ({
    id: p.id,
    version: p.version,
    nameEn: SETUP_EN[p.key],
    nameHi: SETUP_HI[p.key],
    status: p.available ? SECTOR_PACK_STATUS.sample : SECTOR_PACK_STATUS.planned,
    available: p.available,
    defaults: p.defaultsId ? structuredClone(PACK_DEFAULTS[p.defaultsId] ?? null) : null,
  }));
}
