import type { SectorPack } from "../sector-pack.types";
import educationV1 from "./education.v1.json";

/**
 * Adding a ninth sector pack means adding one JSON file + one line here —
 * zero changes to register/notices/retention engine code, which all read
 * a pack's schema at runtime through SectorPackRegistryService.
 */
export const SECTOR_PACK_MANIFEST: SectorPack[] = [educationV1 as SectorPack];
