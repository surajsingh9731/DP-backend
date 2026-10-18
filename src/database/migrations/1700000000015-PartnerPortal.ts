import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  userOwnedTableSql,
} from "../rls/enable-rls";

/**
 * Module O (R2): the partner portal's own tables. Neither carries a
 * tenant_id — a partner isn't a member of one organisation, they advise
 * several — so both are scoped by `userOwnedTableSql` (RLS keyed on the
 * row's own user_id matching app.user_id) instead of the usual
 * tenantIsolationSql.
 */
export class PartnerPortal1700000000015 implements MigrationInterface {
  name = "PartnerPortal1700000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE partner_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        brand_name text NOT NULL,
        logo_ref text,
        contact_email text NOT NULL,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT partner_profiles_user_unique UNIQUE (user_id)
      )
    `);
    for (const sql of userOwnedTableSql("partner_profiles"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("partner_profiles"))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE commission_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        organisation_id uuid NOT NULL REFERENCES organisations(id),
        amount_inr numeric(10,2) NOT NULL,
        note text,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX commission_records_user_id_idx ON commission_records (user_id)`,
    );
    for (const sql of userOwnedTableSql("commission_records"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("commission_records"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("commission_records"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS commission_records`);
    for (const sql of revokeAppRoleSql("partner_profiles"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS partner_profiles`);
  }
}
