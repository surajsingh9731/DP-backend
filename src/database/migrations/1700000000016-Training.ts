import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  revokeAppRoleSql,
  tenantIsolationSql,
} from "../rls/enable-rls";

/** Module P (R2): staff training progress. Lesson content itself is pure data (src/training/data/lessons.ts) — only progress is a real table. */
export class Training1700000000016 implements MigrationInterface {
  name = "Training1700000000016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE training_progress (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        user_id uuid NOT NULL REFERENCES users(id),
        lesson_code text NOT NULL,
        status text NOT NULL DEFAULT 'not_started',
        quiz_score int,
        certificate_id uuid,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT training_progress_tenant_user_lesson_unique UNIQUE (tenant_id, user_id, lesson_code)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX training_progress_tenant_user_idx ON training_progress (tenant_id, user_id)`,
    );
    for (const sql of tenantIsolationSql("training_progress"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("training_progress"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("training_progress"))
      await queryRunner.query(sql);
    await queryRunner.query(`DROP TABLE IF EXISTS training_progress`);
  }
}
