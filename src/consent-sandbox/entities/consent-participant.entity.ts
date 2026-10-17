import { Entity, Column, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'consent_participants', synchronize: false })
export class ConsentParticipantEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'offer_id', type: 'uuid' }) offerId!: string;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'token_hash', type: 'text' }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked', type: 'boolean' }) revoked!: boolean;
  @Column({ name: 'version', type: 'integer' }) version!: number;
}
