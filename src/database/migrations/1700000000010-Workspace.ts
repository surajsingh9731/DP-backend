import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Workspace1700000000010 implements MigrationInterface {
  name = 'Workspace1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE workspace_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        template TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        assignee TEXT,
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX workspace_tasks_tenant_idx ON workspace_tasks (tenant_id)');

    await queryRunner.query(`
      CREATE TABLE workspace_task_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id UUID NOT NULL REFERENCES workspace_tasks(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        event_hash TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sequence BIGSERIAL NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX workspace_task_events_tenant_idx ON workspace_task_events (tenant_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS workspace_task_events');
    await queryRunner.query('DROP TABLE IF EXISTS workspace_tasks');
  }
}
