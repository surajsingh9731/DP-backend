import type { RegisterData, SectorPackView } from "@sahmati/contracts";

/**
 * Sector packs are data, not code (see docs/sources — this is the core
 * product decision: a ninth sector should need no engine change). Only
 * Education has a reviewed-enough sample to offer working defaults; every
 * other pack is intentionally `planned-unreviewed` with no defaults, so the
 * UI shows it but cannot silently fabricate content for it.
 */
const EDUCATION_DEFAULTS: RegisterData = {
  name: "Admissions",
  purposeEn: "Prepare admissions records for the current academic session.",
  purposeHi: "चालू शैक्षणिक सत्र के लिए प्रवेश रिकॉर्ड तैयार करना।",
  dataCategories: ["Contact", "Guardian", "Academic"],
  storageLocation: "Local sample storage",
  retentionNote: "Retention period not yet reviewed by a qualified reviewer.",
  contact: "Front office",
};

export const SECTOR_PACKS: SectorPackView[] = [
  {
    id: "education",
    version: 1,
    nameEn: "Education",
    nameHi: "शिक्षा",
    status: "sample-draft",
    available: true,
    defaults: EDUCATION_DEFAULTS,
  },
  {
    id: "health",
    version: 1,
    nameEn: "Health",
    nameHi: "स्वास्थ्य",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "employer",
    version: 1,
    nameEn: "Employer",
    nameHi: "नियोक्ता",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "property",
    version: 1,
    nameEn: "Real estate & recruitment",
    nameHi: "रियल एस्टेट और भर्ती",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "retail",
    version: 1,
    nameEn: "Retail & services",
    nameHi: "खुदरा और सेवाएं",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "hospitality",
    version: 1,
    nameEn: "Hospitality",
    nameHi: "आतिथ्य",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "events",
    version: 1,
    nameEn: "Events & exhibitions",
    nameHi: "कार्यक्रम और प्रदर्शनी",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
  {
    id: "housing",
    version: 1,
    nameEn: "Housing societies",
    nameHi: "हाउसिंग सोसायटी",
    status: "planned-unreviewed",
    available: false,
    defaults: null,
  },
];

export function findSectorPack(id: string): SectorPackView | undefined {
  return SECTOR_PACKS.find((pack) => pack.id === id);
}
