import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { FollowupAction, FollowupTask } from '@sahmati/contracts';

/** Full immutable snapshot of a followup task as it stood after each action. */
@Entity({ name: 'followup_events' })
@Index(['taskId'])
export class FollowupEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  taskId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'text' })
  action!: FollowupAction | 'created';

  @Column({ type: 'text' })
  actorId!: string;

  @Column({ type: 'text', default: '' })
  note!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidenceRefs!: string[];

  @Column({ type: 'text', nullable: true })
  previousHash!: string | null;

  @Column({ type: 'text' })
  eventHash!: string;

  @Column({ type: 'jsonb' })
  task!: FollowupTask;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}
