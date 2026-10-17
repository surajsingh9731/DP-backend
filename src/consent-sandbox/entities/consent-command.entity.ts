import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { ConsentReceipt, ConsentOffer } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'consent_commands', synchronize: false })
export class ConsentCommandEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @PrimaryColumn({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey!: string;
  @Column({ name: 'payload_hash', type: 'text' }) payloadHash!: string;
  @Column({ name: 'response', type: 'jsonb' }) response!: ConsentOffer | ConsentReceipt;
}
