import { Column, PrimaryColumn } from 'typeorm';
import type { RetentionPolicy, RetentionHold } from '@sahmati/contracts';
export abstract class RetentionRecordBase {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'entry_id', type: 'uuid' }) entryId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: RetentionPolicy | RetentionHold;
}
