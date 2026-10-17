import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A short-form event feed just for the workspace dashboard's recent-activity panel. */
@Entity({ name: 'workspace_task_events' })
@Index(['tenantId'])
export class WorkspaceTaskEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  taskId!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text' })
  eventHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;

  @Generated('increment')
  @Column({ type: 'bigint' })
  sequence!: string;
}
