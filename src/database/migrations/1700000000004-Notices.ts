import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module C: the notice (public-facing once published). */
export class Notices1700000000004 implements MigrationInterface {
  name = "Notices1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        title_en text NOT NULL,
        title_hi text NOT NULL,
        body_en text NOT NULL,
        body_hi text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        version int NOT NULL DEFAULT 1,
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX notices_tenant_id_uq ON notices (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("notices"))
      await queryRunner.query(sql);
    // A published notice is the exact thing a data principal reads with no
    // login (brief: public notice page) — openly readable once published,
    // same pattern as organisations' public-read carve-out. Drafts stay
    // strictly tenant-scoped via tenant_isolation above.
    await queryRunner.query(
      `CREATE POLICY notices_public_read ON notices FOR SELECT USING (status = 'published')`,
    );
    for (const sql of grantAppRoleSql("notices")) await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE notice_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        version int NOT NULL,
        title_en text NOT NULL,
        title_hi text NOT NULL,
        body_en text NOT NULL,
        body_hi text NOT NULL,
        published_by_user_id uuid NOT NULL REFERENCES users(id),
        published_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX notice_versions_tenant_id_idx ON notice_versions (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("notice_versions"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("notice_versions", { appendOnly: true }))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("notice_versions"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS notice_versions`);
    for (const sql of revokeAppRoleSql("notices")) await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS notices`);
  }
}
