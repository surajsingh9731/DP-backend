import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Shared, cross-module infrastructure: the evidence ledger and idempotency keys. */
export class Shared1700000000002 implements MigrationInterface {
  name = "Shared1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE evidence_ledger_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        kind text NOT NULL,
        source_id uuid NOT NULL,
        action text NOT NULL,
        status text NOT NULL,
        actor_id uuid,
        provenance text NOT NULL,
        previous_hash text,
        event_hash text NOT NULL,
        occurred_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX evidence_ledger_entries_tenant_created_idx ON evidence_ledger_entries (tenant_id, created_at)`,
    );
    for (const sql of tenantIsolationSql("evidence_ledger_entries"))
      await queryRunner.query(sql);
    // Append-only at the privilege level: no UPDATE/DELETE grant exists at all.
    for (const sql of grantAppRoleSql("evidence_ledger_entries", {
      appendOnly: true,
    }))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        key text NOT NULL,
        response jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idempotency_keys_tenant_key_uq ON idempotency_keys (tenant_id, key)`,
    );
    for (const sql of tenantIsolationSql("idempotency_keys"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("idempotency_keys"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("idempotency_keys"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`);
    for (const sql of revokeAppRoleSql("evidence_ledger_entries"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS evidence_ledger_entries`);
  }
}
