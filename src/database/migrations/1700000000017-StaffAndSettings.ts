import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * R2: staff management (optimistic concurrency on memberships, matching
 * every other mutable entity) and organisation settings (the DPDP-required
 * contact person, published on every notice and reply — see
 * docs/architecture/R1-system-design.md). Both are plain ALTERs on
 * existing RLS-protected tables, so no new RLS policy is needed.
 */
export class StaffAndSettings1700000000017 implements MigrationInterface {
  name = "StaffAndSettings1700000000017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE memberships ADD COLUMN version int NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(`
      ALTER TABLE organisations
        ADD COLUMN contact_name text,
        ADD COLUMN contact_role text,
        ADD COLUMN contact_phone text,
        ADD COLUMN contact_email text,
        ADD COLUMN version int NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE organisations
        DROP COLUMN contact_name,
        DROP COLUMN contact_role,
        DROP COLUMN contact_phone,
        DROP COLUMN contact_email,
        DROP COLUMN version
    `);
    await queryRunner.query(`ALTER TABLE memberships DROP COLUMN version`);
  }
}
