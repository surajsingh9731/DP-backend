import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { TaskStatus, TaskTemplate } from '@sahmati/contracts';

/** A simple owner-created action item shown on the workspace dashboard. */
@Entity({ name: 'workspace_tasks' })
@Index(['tenantId'])
export class WorkspaceTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'text' })
  template!: TaskTemplate;

  @Column({ type: 'text', default: 'open' })
  status!: TaskStatus;

  @Column({ type: 'text', nullable: true })
  assignee!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
