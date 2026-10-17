import { Injectable, NotFoundException } from "@nestjs/common";
import { SECTOR_PACK_MANIFEST } from "../data/manifest";
import type { SectorPack } from "../sector-pack.types";

/**
 * The only place engine code reads sector behaviour from. Register,
 * notices and retention all call `getActive(code)` and branch on the
 * returned data — never on a sector name string.
 */
@Injectable()
export class SectorPackRegistryService {
  private readonly byCode = new Map(
    SECTOR_PACK_MANIFEST.map((pack) => [pack.code, pack]),
  );

  list(): SectorPack[] {
    return [...this.byCode.values()];
  }

  getActive(code: string): SectorPack {
    const pack = this.byCode.get(code);
    if (!pack) throw new NotFoundException(`Unknown sector pack: ${code}.`);
    return pack;
  }
}
