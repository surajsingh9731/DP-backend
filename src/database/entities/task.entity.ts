import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'tasks' })
export class TaskEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' }) tenantId!: string;
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('uuid', { name: 'branch_id' }) branchId!: string;
  @Column('uuid', { name: 'assignee_id' }) assigneeId!: string;
  @Column('text', { name: 'template' }) template!: 'review_inventory';
  @Column('text', { name: 'status', default: 'open' }) status!: 'open' | 'closed';
  @Column('uuid', { name: 'idempotency_key' }) idempotencyKey!: string;
  @Column('timestamptz', { name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
  @Column('integer', { name: 'version', default: 1 }) version!: number;
}
