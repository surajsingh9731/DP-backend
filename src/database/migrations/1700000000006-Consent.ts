import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  participantOwnRowSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Modules D/F: consent capture, the hash-chained ledger, and withdrawal follow-ups. */
export class Consent1700000000006 implements MigrationInterface {
  name = "Consent1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consent_receipts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        verification_session_id uuid NOT NULL REFERENCES public_verification_sessions(id),
        identifier_masked text NOT NULL,
        kind text NOT NULL,
        choices jsonb NOT NULL,
        previous_receipt_hash text,
        receipt_hash text NOT NULL,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX consent_receipts_tenant_occurred_idx ON consent_receipts (tenant_id, occurred_at)`,
    );
    for (const sql of tenantIsolationSql("consent_receipts"))
      await queryRunner.query(sql);
    // A participant reads their own receipts (e.g. a future "my consent
    // history" view) without a staff session — see enable-rls.ts.
    for (const sql of participantOwnRowSql("consent_receipts"))
      await queryRunner.query(sql);
    // Append-only: a withdrawal is a new receipt, never an edit to a past one.
    for (const sql of grantAppRoleSql("consent_receipts", { appendOnly: true }))
      await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE withdrawal_followups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        receipt_id uuid NOT NULL REFERENCES consent_receipts(id),
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX withdrawal_followups_tenant_status_idx ON withdrawal_followups (tenant_id, status)`,
    );
    for (const sql of tenantIsolationSql("withdrawal_followups"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("withdrawal_followups"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("withdrawal_followups"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS withdrawal_followups`);
    for (const sql of revokeAppRoleSql("consent_receipts"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS consent_receipts`);
  }
}
