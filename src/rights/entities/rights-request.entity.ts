import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { RightsRequest } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'rights_requests', synchronize: false })
export class RightsRequestEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'session_id', type: 'uuid' }) sessionId!: string;
  @Column({ name: 'assignee_id', type: 'uuid', nullable: true }) assigneeId!: string | null;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'data', type: 'jsonb' }) data!: RightsRequest;
}
