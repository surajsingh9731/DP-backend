import { describe, expect, it } from "vitest";
import {
  findSectorPack,
  SECTOR_PACKS,
} from "../../src/setup/sector-packs.data";

describe("sector packs", () => {
  it("ships exactly the 8 named sectors from the brief", () => {
    expect(SECTOR_PACKS.map((pack) => pack.id)).toEqual([
      "education",
      "health",
      "employer",
      "property",
      "retail",
      "hospitality",
      "events",
      "housing",
    ]);
  });

  it("only Education is available with real defaults; every other pack is planned-unreviewed", () => {
    const education = findSectorPack("education")!;
    expect(education.available).toBe(true);
    expect(education.defaults).not.toBeNull();

    for (const pack of SECTOR_PACKS.filter((p) => p.id !== "education")) {
      expect(pack.available).toBe(false);
      expect(pack.status).toBe("planned-unreviewed");
      expect(pack.defaults).toBeNull();
    }
  });
});
