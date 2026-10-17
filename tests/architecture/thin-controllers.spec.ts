import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "../../src");

function findControllerFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findControllerFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".controller.ts")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Controllers are transport-only (HTTP in, DTO out) — all business logic
 * and all TypeORM access live in services. This is checked mechanically
 * so the rule can't quietly rot as modules are added.
 */
describe("Architecture: controllers stay transport-only", () => {
  const controllerFiles = findControllerFiles(SRC_ROOT);

  it("found at least one controller to check", () => {
    expect(controllerFiles.length).toBeGreaterThan(0);
  });

  it.each(controllerFiles)("%s imports no TypeORM symbols", (fullPath) => {
    const source = readFileSync(fullPath, "utf8");
    expect(source).not.toMatch(/from ['"]typeorm['"]/u);
    expect(source).not.toMatch(/from ['"]@nestjs\/typeorm['"]/u);
  });
});
