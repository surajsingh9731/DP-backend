import type { MigrationInterface, QueryRunner } from "typeorm";

export class Followups1700000000007 implements MigrationInterface {
  name = "Followups1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE followup_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        receipt_id UUID NOT NULL,
        receipt_hash TEXT NOT NULL,
        session_id UUID NOT NULL,
        notice_id UUID NOT NULL,
        entry_version INT NOT NULL,
        withdrawn_purpose_ids JSONB NOT NULL,
        location JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        version INT NOT NULL DEFAULT 1,
        responsible_role TEXT NOT NULL,
        assignee JSONB,
        declared_by TEXT,
        declared_evidence JSONB NOT NULL DEFAULT '[]',
        retention_note TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'local-sample',
        applicability TEXT NOT NULL DEFAULT 'unreviewed-candidate',
        mapping_resolution JSONB,
        mapped_task_ids JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX followup_tasks_tenant_idx ON followup_tasks (tenant_id)",
    );

    await queryRunner.query(`
      CREATE TABLE followup_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES followup_tasks(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        evidence_refs JSONB NOT NULL DEFAULT '[]',
        previous_hash TEXT,
        event_hash TEXT NOT NULL,
        task JSONB NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX followup_events_task_idx ON followup_events (task_id)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS followup_events");
    await queryRunner.query("DROP TABLE IF EXISTS followup_tasks");
  }
}
