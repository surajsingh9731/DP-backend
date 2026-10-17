import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module B: the data register (what's collected, why, where, under what legal basis). */
export class Register1700000000003 implements MigrationInterface {
  name = "Register1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE register_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        category_code text NOT NULL,
        purpose_en text NOT NULL,
        purpose_hi text NOT NULL,
        legal_basis text NOT NULL,
        legal_basis_overridden boolean NOT NULL DEFAULT false,
        legal_basis_reason text,
        retention_days int NOT NULL,
        has_paper_records boolean NOT NULL DEFAULT false,
        vendor_references jsonb NOT NULL DEFAULT '[]',
        storage_references jsonb NOT NULL DEFAULT '[]',
        status text NOT NULL DEFAULT 'draft',
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX register_entries_tenant_id_idx ON register_entries (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("register_entries"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("register_entries"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE register_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        entry_id uuid NOT NULL REFERENCES register_entries(id),
        version int NOT NULL,
        action text NOT NULL,
        actor_user_id uuid NOT NULL REFERENCES users(id),
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX register_revisions_tenant_entry_idx ON register_revisions (tenant_id, entry_id)`,
    );
    for (const sql of tenantIsolationSql("register_revisions"))
      await queryRunner.query(sql);
    // Append-only, same reasoning as the evidence ledger: a revision row is a historical fact, never edited.
    for (const sql of grantAppRoleSql("register_revisions", {
      appendOnly: true,
    }))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("register_revisions"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS register_revisions`);
    for (const sql of revokeAppRoleSql("register_entries"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS register_entries`);
  }
}
