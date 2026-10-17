import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  participantOwnRowSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module G: the rights/grievance desk. */
export class Rights1700000000008 implements MigrationInterface {
  name = "Rights1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rights_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        verification_session_id uuid NOT NULL REFERENCES public_verification_sessions(id),
        identifier_masked text NOT NULL,
        kind text NOT NULL,
        details text NOT NULL,
        status text NOT NULL DEFAULT 'requested',
        version int NOT NULL DEFAULT 1,
        auto_access_summary text,
        response_text text,
        responded_at timestamptz,
        due_at timestamptz NOT NULL,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX rights_requests_tenant_status_idx ON rights_requests (tenant_id, status)`,
    );
    for (const sql of tenantIsolationSql("rights_requests"))
      await queryRunner.query(sql);
    // A participant checks their own request's status with no staff
    // session (brief: "verified public request entry/status").
    for (const sql of participantOwnRowSql("rights_requests"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("rights_requests"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("rights_requests"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS rights_requests`);
  }
}
