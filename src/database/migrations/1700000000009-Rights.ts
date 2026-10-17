import type { MigrationInterface, QueryRunner } from "typeorm";

export class Rights1700000000009 implements MigrationInterface {
  name = "Rights1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rights_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        session_id UUID NOT NULL,
        synthetic_reference TEXT NOT NULL,
        kind TEXT NOT NULL,
        input_language TEXT NOT NULL,
        details TEXT NOT NULL,
        correction JSONB,
        source JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        version INT NOT NULL DEFAULT 1,
        assignee JSONB,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        mode TEXT NOT NULL DEFAULT 'local-sample',
        assurance TEXT NOT NULL DEFAULT 'unverified-synthetic-adult'
      )
    `);
    await queryRunner.query(
      "CREATE INDEX rights_requests_tenant_idx ON rights_requests (tenant_id)",
    );

    await queryRunner.query(`
      CREATE TABLE rights_work_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES rights_requests(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL DEFAULT 1,
        location JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        declared_by TEXT,
        declared_evidence JSONB NOT NULL DEFAULT '[]',
        related_followup_task_id UUID
      )
    `);
    await queryRunner.query(
      "CREATE INDEX rights_work_items_request_idx ON rights_work_items (request_id)",
    );

    await queryRunner.query(`
      CREATE TABLE rights_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES rights_requests(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        language TEXT NOT NULL,
        text TEXT NOT NULL,
        resolution TEXT NOT NULL,
        unresolved_count INT NOT NULL,
        request_version INT NOT NULL
      )
    `);
    await queryRunner.query(
      "CREATE INDEX rights_responses_request_idx ON rights_responses (request_id)",
    );

    await queryRunner.query(`
      CREATE TABLE rights_audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES rights_requests(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL,
        action TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        actor_id TEXT NOT NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        evidence_refs JSONB NOT NULL DEFAULT '[]',
        previous_hash TEXT,
        event_hash TEXT NOT NULL
      )
    `);
    await queryRunner.query(
      "CREATE INDEX rights_audit_events_request_idx ON rights_audit_events (request_id)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS rights_audit_events");
    await queryRunner.query("DROP TABLE IF EXISTS rights_responses");
    await queryRunner.query("DROP TABLE IF EXISTS rights_work_items");
    await queryRunner.query("DROP TABLE IF EXISTS rights_requests");
  }
}
