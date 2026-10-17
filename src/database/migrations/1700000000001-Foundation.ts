import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundation schema: tenants, users, memberships, auth challenges, sessions,
 * the shared evidence ledger, idempotency keys, and the local mail sink.
 * Everything every later module depends on.
 */
export class Foundation1700000000001 implements MigrationInterface {
  name = 'Foundation1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, user_id)
      )
    `);
    await queryRunner.query('CREATE INDEX memberships_user_id_idx ON memberships (user_id)');

    await queryRunner.query(`
      CREATE TABLE auth_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('en', 'hi')),
        code_hash TEXT NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX sessions_user_id_idx ON sessions (user_id)');

    await queryRunner.query(`
      CREATE TABLE local_mail (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        tenant_id UUID NOT NULL,
        key TEXT NOT NULL,
        response_status INT NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, key)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE evidence_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        source_id UUID NOT NULL,
        version INT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        provenance TEXT NOT NULL,
        actor_id TEXT,
        note TEXT,
        evidence_refs JSONB NOT NULL DEFAULT '[]',
        detail JSONB NOT NULL DEFAULT '{}',
        previous_hash TEXT,
        event_hash TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sequence BIGSERIAL NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX evidence_ledger_tenant_kind_source_idx ON evidence_ledger_entries (tenant_id, kind, source_id)',
    );
    await queryRunner.query(
      'CREATE INDEX evidence_ledger_tenant_occurred_idx ON evidence_ledger_entries (tenant_id, occurred_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS evidence_ledger_entries');
    await queryRunner.query('DROP TABLE IF EXISTS idempotency_keys');
    await queryRunner.query('DROP TABLE IF EXISTS local_mail');
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query('DROP TABLE IF EXISTS auth_challenges');
    await queryRunner.query('DROP TABLE IF EXISTS memberships');
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TABLE IF EXISTS tenants');
  }
}
