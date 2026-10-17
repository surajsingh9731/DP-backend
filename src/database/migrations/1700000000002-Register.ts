import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Register1700000000002 implements MigrationInterface {
  name = 'Register1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE register_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        name TEXT NOT NULL,
        purpose_en TEXT NOT NULL,
        purpose_hi TEXT NOT NULL,
        data_categories JSONB NOT NULL,
        storage_location TEXT NOT NULL,
        retention_note TEXT NOT NULL,
        contact TEXT NOT NULL,
        vendor_references JSONB NOT NULL DEFAULT '[]',
        storage_references JSONB NOT NULL DEFAULT '[]',
        has_paper_records BOOLEAN NOT NULL DEFAULT false,
        source_pack JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX register_entries_tenant_idx ON register_entries (tenant_id)');

    await queryRunner.query(`
      CREATE TABLE register_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_id UUID NOT NULL REFERENCES register_entries(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX register_revisions_entry_idx ON register_revisions (entry_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS register_revisions');
    await queryRunner.query('DROP TABLE IF EXISTS register_entries');
  }
}
