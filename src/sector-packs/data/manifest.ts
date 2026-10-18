import type { SectorPack } from "../sector-pack.types";
import educationV1 from "./education.v1.json";
import healthV1 from "./health.v1.json";
import employerV1 from "./employer.v1.json";

/**
 * Adding a ninth sector pack means adding one JSON file + one line here —
 * zero changes to register/notices/retention engine code, which all read
 * a pack's schema at runtime through SectorPackRegistryService. Health and
 * employer (R2) prove this: both added with no engine change at all.
 */
export const SECTOR_PACK_MANIFEST: SectorPack[] = [
  educationV1 as SectorPack,
  healthV1 as SectorPack,
  employerV1 as SectorPack,
];
