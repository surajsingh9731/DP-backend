import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Notices1700000000005 implements MigrationInterface {
  name = 'Notices1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notice_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entry_id UUID NOT NULL,
        entry_version INT NOT NULL,
        language TEXT NOT NULL,
        legal_review_status TEXT NOT NULL DEFAULT 'unreviewed',
        source_pack JSONB,
        preview JSONB NOT NULL,
        register_data JSONB NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        submitted_by TEXT NOT NULL,
        review_version INT NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'in_review',
        decisions JSONB NOT NULL DEFAULT '[]',
        preparation_source JSONB
      )
    `);
    await queryRunner.query('CREATE INDEX notice_snapshots_tenant_idx ON notice_snapshots (tenant_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS notice_snapshots');
  }
}
