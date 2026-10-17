import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module J (R2): the vendor register — agreements and deletion-instruction tracking. */
export class Vendors1700000000013 implements MigrationInterface {
  name = "Vendors1700000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vendors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        name text NOT NULL,
        service_description text NOT NULL,
        contact_email text NOT NULL,
        agreement_status text NOT NULL DEFAULT 'not_sent',
        agreement_sent_at timestamptz,
        agreement_signed_at timestamptz,
        agreement_document_ref text,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX vendors_tenant_id_idx ON vendors (tenant_id)`,
    );
    for (const sql of tenantIsolationSql("vendors"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("vendors")) await queryRunner.query(sql);

    await queryRunner.query(`
      CREATE TABLE vendor_deletion_instructions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        vendor_id uuid NOT NULL REFERENCES vendors(id),
        register_entry_id uuid NOT NULL REFERENCES register_entries(id),
        instruction_text text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        acknowledged_at timestamptz,
        resolved_at timestamptz,
        evidence_note text,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX vendor_deletion_instructions_tenant_vendor_idx ON vendor_deletion_instructions (tenant_id, vendor_id)`,
    );
    for (const sql of tenantIsolationSql("vendor_deletion_instructions"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("vendor_deletion_instructions"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("vendor_deletion_instructions"))
      await queryRunner.query(sql);
    await queryRunner.query(
      `DROP TABLE IF EXISTS vendor_deletion_instructions`,
    );
    for (const sql of revokeAppRoleSql("vendors")) await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS vendors`);
  }
}
