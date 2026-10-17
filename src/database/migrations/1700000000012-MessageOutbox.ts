import type { MigrationInterface, QueryRunner } from "typeorm";

export class MessageOutbox1700000000012 implements MigrationInterface {
  name = "MessageOutbox1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE message_outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        channel TEXT NOT NULL DEFAULT 'email',
        recipient TEXT NOT NULL,
        template TEXT NOT NULL,
        language TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        lease_until TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        failure_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      "CREATE INDEX message_outbox_tenant_status_idx ON message_outbox (tenant_id, status)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS message_outbox");
  }
}
