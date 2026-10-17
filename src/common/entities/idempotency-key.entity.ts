import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Records one accepted mutation per (tenantId, key). A retried submission
 * with the same client-generated key returns the original stored response
 * instead of performing the action twice — this is what lets the frontend
 * safely retry a save/action after a dropped connection.
 */
@Entity({ name: 'idempotency_keys' })
export class IdempotencyKeyEntity {
  @PrimaryColumn({ type: 'uuid' })
  tenantId!: string;

  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'int' })
  responseStatus!: number;

  @Column({ type: 'jsonb' })
  responseBody!: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
