import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { ConsentReceipt } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'consent_receipts', synchronize: false })
export class ConsentReceiptEntity {
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'session_id', type: 'uuid' }) sessionId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: ConsentReceipt;
}
