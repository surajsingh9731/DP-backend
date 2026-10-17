import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'identity', name: 'challenges' })
export class ChallengeEntity {
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('text', { name: 'code_hash' }) codeHash!: string;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt!: Date;
  @Column('integer', { name: 'attempts', default: 0 }) attempts!: number;
  @Column('timestamptz', { name: 'consumed_at', nullable: true }) consumedAt!: Date | null;
  @Column('timestamptz', { name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
