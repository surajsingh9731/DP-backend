import type { MigrationInterface, QueryRunner } from "typeorm";

export class Retention1700000000011 implements MigrationInterface {
  name = "Retention1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entry_id UUID NOT NULL,
        entry_version INT NOT NULL,
        name TEXT NOT NULL,
        duration_days INT NOT NULL,
        rationale TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX retention_policies_tenant_entry_idx ON retention_policies (tenant_id, entry_id)",
    );

    await queryRunner.query(`
      CREATE TABLE retention_holds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entry_id UUID NOT NULL,
        scope TEXT NOT NULL,
        target TEXT,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX retention_holds_tenant_entry_idx ON retention_holds (tenant_id, entry_id)",
    );

    await queryRunner.query(`
      CREATE TABLE retention_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        record_type TEXT NOT NULL,
        record_id UUID NOT NULL,
        version INT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX retention_history_record_idx ON retention_history (record_type, record_id)",
    );

    await queryRunner.query(`
      CREATE TABLE retention_previews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entry_id UUID NOT NULL,
        as_of TIMESTAMPTZ NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        items JSONB NOT NULL,
        summary JSONB NOT NULL,
        entry_version INT NOT NULL,
        freshness TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        integrity TEXT NOT NULL
      )
    `);
    await queryRunner.query(
      "CREATE INDEX retention_previews_tenant_entry_idx ON retention_previews (tenant_id, entry_id)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS retention_previews");
    await queryRunner.query("DROP TABLE IF EXISTS retention_history");
    await queryRunner.query("DROP TABLE IF EXISTS retention_holds");
    await queryRunner.query("DROP TABLE IF EXISTS retention_policies");
  }
}
