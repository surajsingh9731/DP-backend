import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { PreparationRecordView } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'preparation_commands', synchronize: false })
export class PreparationCommandEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @PrimaryColumn({ name: 'idempotency_key', type: 'uuid' }) idempotencyKey!: string;
  @Column({ name: 'record_id', type: 'uuid' }) recordId!: string;
  @Column({ name: 'payload_hash', type: 'text' }) payloadHash!: string;
  @Column({ type: 'jsonb' }) response!: PreparationRecordView;
}
