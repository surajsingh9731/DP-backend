import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** R2: dedupe record for the automated retention scheduler (see RetentionSchedulerService). */
export class RetentionAlerts1700000000012 implements MigrationInterface {
  name = "RetentionAlerts1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE retention_alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        register_entry_id uuid NOT NULL REFERENCES register_entries(id),
        raised_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT retention_alerts_tenant_entry_unique UNIQUE (tenant_id, register_entry_id)
      )
    `);
    for (const sql of tenantIsolationSql("retention_alerts"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("retention_alerts"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("retention_alerts"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS retention_alerts`);
  }
}
