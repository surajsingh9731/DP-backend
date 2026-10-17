import { Column, PrimaryColumn } from 'typeorm';
import type { RetentionPolicy, RetentionHold, RetentionEvent } from '@sahmati/contracts';
export abstract class RetentionEventBase {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'record_id', type: 'uuid' }) recordId!: string;
  @PrimaryColumn({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: RetentionEvent<RetentionPolicy | RetentionHold>;
}
