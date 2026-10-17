import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'identity', name: 'sessions' })
export class SessionEntity {
  @PrimaryColumn('text', { name: 'token_hash' }) tokenHash!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt!: Date;
  @Column('timestamptz', { name: 'revoked_at', nullable: true }) revokedAt!: Date | null;
  @Column('timestamptz', { name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
