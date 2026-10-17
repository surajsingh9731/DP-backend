import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  grantAppRoleSql,
  operationalAccessSql,
  revokeAppRoleSql,
} from "../rls/enable-rls";

/** Shared data-principal verification infrastructure, used by modules D/F/G's public flows. */
export class Participants1700000000005 implements MigrationInterface {
  name = "Participants1700000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public_verification_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organisations(id),
        identifier text NOT NULL,
        channel text NOT NULL,
        code_hash text NOT NULL,
        attempts int NOT NULL DEFAULT 0,
        verified boolean NOT NULL DEFAULT false,
        token_hash text,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX public_verification_sessions_tenant_id_idx ON public_verification_sessions (tenant_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX public_verification_sessions_token_hash_uq ON public_verification_sessions (token_hash) WHERE token_hash IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE public_verification_sessions ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE public_verification_sessions FORCE ROW LEVEL SECURITY`,
    );
    // Looked up only by its own opaque id (start/confirm) or token hash
    // (ParticipantSessionGuard) — never listed. Same reasoning as
    // auth_challenges/sessions.
    for (const sql of operationalAccessSql("public_verification_sessions"))
      await queryRunner.query(sql);
    for (const sql of grantAppRoleSql("public_verification_sessions"))
      await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of revokeAppRoleSql("public_verification_sessions"))
      await queryRunner.query(sql);
    await queryRunner.query(
      `DROP TABLE IF EXISTS public_verification_sessions`,
    );
  }
}
