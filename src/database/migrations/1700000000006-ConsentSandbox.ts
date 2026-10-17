import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsentSandbox1700000000006 implements MigrationInterface {
  name = 'ConsentSandbox1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consent_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version INT NOT NULL DEFAULT 1,
        catalog_hash TEXT NOT NULL,
        notice JSONB NOT NULL,
        purposes JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX consent_offers_tenant_idx ON consent_offers (tenant_id)');

    await queryRunner.query(`
      CREATE TABLE consent_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        offer_id UUID NOT NULL REFERENCES consent_offers(id) ON DELETE CASCADE,
        synthetic_reference TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        version INT NOT NULL DEFAULT 0,
        ended BOOLEAN NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      'CREATE INDEX consent_participants_tenant_idx ON consent_participants (tenant_id)',
    );

    await queryRunner.query(`
      CREATE TABLE consent_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES consent_participants(id) ON DELETE CASCADE,
        synthetic_reference TEXT NOT NULL,
        offer JSONB NOT NULL,
        version INT NOT NULL,
        kind TEXT NOT NULL,
        choices JSONB NOT NULL,
        interface_language TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        previous_receipt_hash TEXT,
        receipt_hash TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'local-sample',
        assurance TEXT NOT NULL DEFAULT 'unverified-synthetic-adult',
        legal_review_status TEXT NOT NULL DEFAULT 'unreviewed',
        contact_verification TEXT NOT NULL DEFAULT 'unverified',
        deletion_status TEXT NOT NULL DEFAULT 'not-performed'
      )
    `);
    await queryRunner.query(
      'CREATE INDEX consent_receipts_tenant_session_idx ON consent_receipts (tenant_id, session_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS consent_receipts');
    await queryRunner.query('DROP TABLE IF EXISTS consent_participants');
    await queryRunner.query('DROP TABLE IF EXISTS consent_offers');
  }
}
