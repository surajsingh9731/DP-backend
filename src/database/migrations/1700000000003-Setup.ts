import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Setup1700000000003 implements MigrationInterface {
  name = 'Setup1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE setup_records (
        tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL DEFAULT 0,
        organisation_name TEXT NOT NULL DEFAULT '',
        pack_id TEXT NOT NULL DEFAULT '',
        pack_version INT NOT NULL DEFAULT 1,
        step INT NOT NULL DEFAULT 1,
        draft JSONB,
        status TEXT NOT NULL DEFAULT 'draft',
        register_entry_id UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS setup_records');
  }
}
