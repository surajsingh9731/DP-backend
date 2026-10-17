import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { FollowupTask } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'followup_tasks', synchronize: false })
export class FollowupTaskEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'receipt_id', type: 'uuid' }) receiptId!: string;
  @Column({ name: 'location_key', type: 'text' }) locationKey!: string;
  @Column({ name: 'assignee_id', type: 'uuid', nullable: true }) assigneeId!: string | null;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'data', type: 'jsonb' }) data!: FollowupTask;
}
