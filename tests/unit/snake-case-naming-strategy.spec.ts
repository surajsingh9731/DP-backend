import { describe, expect, it } from "vitest";
import { SnakeCaseNamingStrategy } from "../../src/database/snake-case.naming-strategy";

describe("SnakeCaseNamingStrategy", () => {
  const strategy = new SnakeCaseNamingStrategy();

  it("converts a camelCase property to snake_case", () => {
    expect(strategy.columnName("tenantId", undefined)).toBe("tenant_id");
    expect(strategy.columnName("createdAt", undefined)).toBe("created_at");
    expect(strategy.columnName("sequence", undefined)).toBe("sequence");
  });

  it("respects an explicit custom column name over the derived one", () => {
    expect(strategy.columnName("tenantId", "tenant_ref")).toBe("tenant_ref");
  });
});
