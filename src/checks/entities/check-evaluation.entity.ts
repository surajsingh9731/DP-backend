import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { CheckEvaluation } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'check_evaluations', synchronize: false })
export class CheckEvaluationEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'task_id', type: 'uuid' }) taskId!: string;
  @Column({ name: 'computed_at', type: 'timestamptz' }) computedAt!: Date;
  @Column({ name: 'data', type: 'jsonb' }) data!: CheckEvaluation;
}
