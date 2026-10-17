import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { RetentionSnapshot } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'retention_previews', synchronize: false })
export class RetentionPreviewEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'entry_id', type: 'uuid' }) entryId!: string;
  @Column({ name: 'data', type: 'jsonb' }) data!: RetentionSnapshot;
}
