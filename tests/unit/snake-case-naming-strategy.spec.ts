import { describe, expect, it } from "vitest";
import { SnakeCaseNamingStrategy } from "../../src/database/snake-case.naming-strategy";

describe("SnakeCaseNamingStrategy", () => {
  const strategy = new SnakeCaseNamingStrategy();

  it("converts camelCase entity names to snake_case table names", () => {
    expect(strategy.tableName("OrganisationEntity", undefined)).toBe(
      "organisation_entity",
    );
  });

  it("respects an explicit @Entity({ name }) override", () => {
    expect(strategy.tableName("OrganisationEntity", "organisations")).toBe(
      "organisations",
    );
  });

  it("converts camelCase column properties to snake_case", () => {
    expect(strategy.columnName("sectorPackCode", undefined, [])).toBe(
      "sector_pack_code",
    );
  });
});
