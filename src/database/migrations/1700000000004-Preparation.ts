import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Preparation1700000000004 implements MigrationInterface {
  name = 'Preparation1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE preparation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('template', 'contact')),
        version INT NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        data JSONB NOT NULL,
        legal_review_status TEXT NOT NULL DEFAULT 'unreviewed',
        contact_verification TEXT NOT NULL DEFAULT 'unverified',
        content_hash TEXT NOT NULL,
        source_pack JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX preparation_records_tenant_idx ON preparation_records (tenant_id)',
    );

    await queryRunner.query(`
      CREATE TABLE preparation_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        record_id UUID NOT NULL REFERENCES preparation_records(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        data JSONB NOT NULL,
        content_hash TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        actor_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX preparation_history_record_idx ON preparation_history (record_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS preparation_history');
    await queryRunner.query('DROP TABLE IF EXISTS preparation_records');
  }
}
