import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module M: the outbound message queue the worker process (src/worker/main.ts) drains. */
export class Messaging1700000000011 implements MigrationInterface {
  name = "Messaging1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE message_outbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        recipient text NOT NULL,
        language text NOT NULL,
        template text NOT NULL,
        payload jsonb NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts int NOT NULL DEFAULT 0,
        last_error text,
        provider_ref text,
        sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX message_outbox_tenant_status_idx ON message_outbox (tenant_id, status)`,
    );
    for (const sql of tenantIsolationSql("message_outbox"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("message_outbox"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("message_outbox"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS message_outbox`);
  }
}
