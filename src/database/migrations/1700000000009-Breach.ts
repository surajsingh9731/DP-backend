import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module H: the breach desk — incident intake through containment and the two DPDP-mandated notifications. */
export class Breach1700000000009 implements MigrationInterface {
  name = "Breach1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE breach_incidents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        title text NOT NULL,
        description text NOT NULL,
        discovered_at timestamptz NOT NULL,
        severity text NOT NULL,
        affected_data_categories jsonb NOT NULL DEFAULT '[]',
        affected_principals_count int,
        status text NOT NULL DEFAULT 'open',
        containment_notes text,
        dpb_notified_at timestamptz,
        principals_notified_at timestamptz,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX breach_incidents_tenant_status_idx ON breach_incidents (tenant_id, status)`,
    );
    for (const sql of tenantIsolationSql("breach_incidents"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("breach_incidents"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("breach_incidents"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS breach_incidents`);
  }
}
