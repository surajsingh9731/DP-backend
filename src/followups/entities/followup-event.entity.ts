import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { FollowupEvent } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'followup_events', synchronize: false })
export class FollowupEventEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'task_id', type: 'uuid' }) taskId!: string;
  @PrimaryColumn({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: FollowupEvent;
}
