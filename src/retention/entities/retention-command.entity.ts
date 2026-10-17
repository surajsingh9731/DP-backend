import { Entity, Column, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'retention_commands', synchronize: false })
export class RetentionCommandEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @PrimaryColumn({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey!: string;
  @Column({ name: 'payload_hash', type: 'text' }) payloadHash!: string;
  @Column({ name: 'response', type: 'jsonb' }) response!: {
    kind: 'policy' | 'hold' | 'preview';
    id: string;
  };
}
