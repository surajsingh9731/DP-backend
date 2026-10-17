import type { MigrationInterface, QueryRunner } from "typeorm";

export class Checks1700000000008 implements MigrationInterface {
  name = "Checks1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE check_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES followup_tasks(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL,
        task_version INT NOT NULL,
        applicability TEXT NOT NULL,
        result TEXT NOT NULL,
        rationale TEXT NOT NULL,
        evidence_refs JSONB NOT NULL,
        reviewer_id TEXT NOT NULL,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        valid_until TIMESTAMPTZ NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'synthetic-manual-reference',
        authenticity TEXT NOT NULL DEFAULT 'not-authenticated'
      )
    `);
    await queryRunner.query(
      "CREATE INDEX check_reviews_task_idx ON check_reviews (task_id)",
    );

    await queryRunner.query(`
      CREATE TABLE check_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES followup_tasks(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_version INT NOT NULL,
        review_version INT NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        computed_by TEXT NOT NULL,
        checks JSONB NOT NULL,
        content_hash TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'local-sample'
      )
    `);
    await queryRunner.query(
      "CREATE INDEX check_evaluations_task_idx ON check_evaluations (task_id)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS check_evaluations");
    await queryRunner.query("DROP TABLE IF EXISTS check_reviews");
  }
}
