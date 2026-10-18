import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * R2: adds the additive "a staff user can see their own membership rows
 * across every tenant" SELECT policy to the existing `memberships` table
 * — the foundation the partner portal's "my organisations" listing reads
 * through. See `ownUserRowSql` in enable-rls.ts for why this is strictly
 * additive (SELECT-only, OR'd alongside the table's existing strict
 * tenant_isolation policy) rather than a new access model.
 */
export class MembershipOwnUserRow1700000000014 implements MigrationInterface {
  name = "MembershipOwnUserRow1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE POLICY memberships_own_user_row ON memberships FOR SELECT USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS memberships_own_user_row ON memberships`,
    );
  }
}
