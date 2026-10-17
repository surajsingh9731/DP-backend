import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { globSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../../src");

function listControllers(): string[] {
  // node:fs globSync is available on Node >=22; src/**/controllers/*.ts
  return globSync(`${ROOT}/**/controllers/*.ts`);
}

/**
 * Architecture rule: controllers are transport-only. They parse the request
 * and call a service — they never touch TypeORM repositories, the
 * DataSource, or persistence directly. This keeps every business rule and
 * transaction boundary in one place (the service layer) instead of leaking
 * into the HTTP layer.
 */
describe("architecture: controllers stay thin", () => {
  const controllers = listControllers();

  it("found at least one controller to check", () => {
    expect(controllers.length).toBeGreaterThan(0);
  });

  it.each(controllers)(
    "%s does not import TypeORM persistence directly",
    (file) => {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/from ['"]typeorm['"]/);
      expect(content).not.toMatch(/@InjectRepository/);
    },
  );
});
