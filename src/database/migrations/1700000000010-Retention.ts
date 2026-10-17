import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/**
 * Module I: retention/erasure. Deliberately no separate "retention policy"
 * table — a register entry's own `retention_days` (module B) is already
 * the single source of truth for how long its data may be kept, so a
 * second policy table would just be a second place for that number to go
 * stale. This module adds only what register_entries doesn't already
 * carry: holds that pause the clock, and an append-only attestation that
 * erasure actually happened.
 */
export class Retention1700000000010 implements MigrationInterface {
  name = "Retention1700000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE retention_holds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        register_entry_id uuid NOT NULL REFERENCES register_entries(id),
        reason text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        placed_by_user_id uuid NOT NULL REFERENCES users(id),
        placed_at timestamptz NOT NULL DEFAULT now(),
        released_by_user_id uuid REFERENCES users(id),
        released_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX retention_holds_tenant_entry_idx ON retention_holds (tenant_id, register_entry_id)`,
    );
    for (const sql of tenantIsolationSql("retention_holds"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("retention_holds"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE retention_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        register_entry_id uuid NOT NULL REFERENCES register_entries(id),
        notes text NOT NULL,
        executed_by_user_id uuid NOT NULL REFERENCES users(id),
        executed_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX retention_actions_tenant_entry_idx ON retention_actions (tenant_id, register_entry_id)`,
    );
    for (const sql of tenantIsolationSql("retention_actions"))
      await queryRunner.query(sql);
    // Append-only: an erasure attestation is a historical fact, never edited.
    for (const sql of grantAppRoleSql("retention_actions", {
      appendOnly: true,
    }))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("retention_actions"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS retention_actions`);
    for (const sql of revokeAppRoleSql("retention_holds"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS retention_holds`);
  }
}
