import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  operationalAccessSql,
  preSessionLookupSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/**
 * Creates the restricted runtime role (sahmati_app — NOSUPERUSER,
 * NOBYPASSRLS) that every request-serving connection uses, then the
 * account/access schema (module A) with real row-level security applied
 * per table. This migration itself runs as the privileged DB_ADMIN_*
 * role, which is the only role ever allowed to run DDL.
 */
export class Foundation1700000000001 implements MigrationInterface {
  name = "Foundation1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appPassword = process.env.DB_PASSWORD;
    if (!appPassword) {
      throw new Error(
        "DB_PASSWORD must be set before running migrations (it provisions the sahmati_app role).",
      );
    }

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sahmati_app') THEN
          CREATE ROLE sahmati_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
      END
      $$;
    `);
    // ALTER ROLE ... PASSWORD cannot be parameterised; the value comes from
    // trusted server-side env, never from request input.
    await queryRunner.query(
      `ALTER ROLE sahmati_app WITH PASSWORD '${appPassword.replace(/'/gu, "''")}'`,
    );
    await queryRunner.query(
      `GRANT CONNECT ON DATABASE "${process.env.DB_DATABASE}" TO sahmati_app`,
    );
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO sahmati_app`);

    await queryRunner.query(`
      CREATE TABLE organisations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        slug text NOT NULL,
        sector_pack_code text NOT NULL,
        sector_pack_version int NOT NULL,
        notice_published boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX organisations_slug_uq ON organisations (slug)`,
    );
    await queryRunner.query(
      `ALTER TABLE organisations ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE organisations FORCE ROW LEVEL SECURITY`,
    );
    // Public notice/Privacy Center reads organisations with no session and
    // no tenant context — see R1-system-design.md §3 for why this table
    // alone carries a public-read policy.
    await queryRunner.query(
      `CREATE POLICY organisations_public_read ON organisations FOR SELECT USING (true)`,
    );
    await queryRunner.query(
      `CREATE POLICY organisations_signup_insert ON organisations FOR INSERT WITH CHECK (true)`,
    );
    await queryRunner.query(`
      CREATE POLICY organisations_tenant_update ON organisations FOR UPDATE
      USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    `);
    for (const sql of grantAppRoleSql("organisations"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE branches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        name text NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX branches_tenant_id_idx ON branches (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("branches"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("branches")) await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        display_name text NOT NULL,
        email text,
        phone_e164 text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_uq ON users (email) WHERE email IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_phone_uq ON users (phone_e164) WHERE phone_e164 IS NOT NULL`,
    );
    // Not tenant-owned (a partner may hold memberships across tenants) —
    // no RLS policy here by design; services must resolve users only
    // through a tenant-scoped membership join.
    for (const sql of grantAppRoleSql("users")) await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        user_id uuid NOT NULL REFERENCES users(id),
        branch_id uuid REFERENCES branches(id),
        role text NOT NULL,
        verified boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX memberships_tenant_id_idx ON memberships (tenant_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX memberships_tenant_user_uq ON memberships (tenant_id, user_id)`,
    );
    for (const sql of tenantIsolationSql("memberships"))
      await queryRunner.query(sql);
    // Login resolves "which tenant does this identifier belong to" before
    // any session/tenant context exists — see preSessionLookupSql.
    for (const sql of preSessionLookupSql("memberships"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("memberships"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE auth_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid REFERENCES organisations(id),
        user_id uuid REFERENCES users(id),
        identifier text NOT NULL,
        channel text NOT NULL,
        purpose text NOT NULL,
        code_hash text NOT NULL,
        attempts int NOT NULL DEFAULT 0,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX auth_challenges_tenant_id_idx ON auth_challenges (tenant_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges FORCE ROW LEVEL SECURITY`,
    );
    for (const sql of operationalAccessSql("auth_challenges"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("auth_challenges"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        user_id uuid NOT NULL REFERENCES users(id),
        membership_id uuid NOT NULL REFERENCES memberships(id),
        role text NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX sessions_tenant_id_idx ON sessions (tenant_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX sessions_token_hash_uq ON sessions (token_hash)`,
    );
    await queryRunner.query(`ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions FORCE ROW LEVEL SECURITY`);
    for (const sql of operationalAccessSql("sessions"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("sessions")) await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE activity_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        actor_user_id uuid REFERENCES users(id),
        action text NOT NULL,
        detail jsonb NOT NULL DEFAULT '{}',
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX activity_log_tenant_id_idx ON activity_log (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("activity_log"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("activity_log"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "activity_log",
      "sessions",
      "auth_challenges",
      "memberships",
      "users",
      "branches",
      "organisations",
    ]) {
      for (const sql of revokeAppRoleSql(table)) await queryRunner.query(sql);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS activity_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_challenges`);
    await queryRunner.query(`DROP TABLE IF EXISTS memberships`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS branches`);
    await queryRunner.query(`DROP TABLE IF EXISTS organisations`);
  }
}
