import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export function sqlMigration(
  name: string,
  path: string,
  timestamp: number,
): new () => MigrationInterface {
  const up = readFileSync(path, 'utf8');
  const down = readFileSync(path.replace(/\.up\.sql$/, '.down.sql'), 'utf8');
  const checksum = createHash('sha256').update(up).digest('hex');
  return class SqlMigration implements MigrationInterface {
    name = `SahmatiSql${timestamp}`;
    async up(runner: QueryRunner): Promise<void> {
      const existing = (await runner.query(
        'SELECT checksum FROM public.schema_migrations WHERE name=$1',
        [name],
      )) as { checksum: string }[];
      if (existing.length) {
        if (existing[0]?.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        return;
      }
      await runner.query(up);
      await runner.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)', [
        name,
        checksum,
      ]);
    }
    async down(runner: QueryRunner): Promise<void> {
      await runner.query(down);
      await runner.query('DELETE FROM public.schema_migrations WHERE name=$1', [name]);
    }
  };
}
