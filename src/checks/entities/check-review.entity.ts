import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { TaskEvidenceReview } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'check_reviews', synchronize: false })
export class CheckReviewEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'task_id', type: 'uuid' }) taskId!: string;
  @PrimaryColumn({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: TaskEvidenceReview;
}
