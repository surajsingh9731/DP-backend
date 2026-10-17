import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The itemised, structured purpose list for a notice — what a consent
 * form actually needs (one checkbox per purpose), distinct from the
 * prose `body_en`/`body_hi`. Lives on `notices`/`notice_versions`
 * specifically so the consent offer can read it through the exact same
 * `status = 'published'` public-read policy those tables already carry,
 * instead of ever opening `register_entries` (which also holds vendor/
 * storage references that are not meant to be public) to anonymous reads.
 */
export class NoticePurposes1700000000007 implements MigrationInterface {
  name = "NoticePurposes1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE notices ADD COLUMN purposes jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE notice_versions ADD COLUMN purposes jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notice_versions DROP COLUMN purposes`);
    await queryRunner.query(`ALTER TABLE notices DROP COLUMN purposes`);
  }
}
