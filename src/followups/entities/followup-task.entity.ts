import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type {
  FollowupAssignee,
  FollowupMode,
  FollowupResponsibleRole,
  FollowupStatus,
  LocationRef,
} from '@sahmati/contracts';

/**
 * One place a withdrawn purpose's data may still live (module F). Created
 * from a withdrawal receipt — one task per declared location on the
 * underlying register entry, or a single unmapped/unknown task when the
 * entry declares none.
 */
@Entity({ name: 'followup_tasks' })
@Index(['tenantId'])
export class FollowupTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  receiptId!: string;

  @Column({ type: 'text' })
  receiptHash!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  noticeId!: string;

  @Column({ type: 'int' })
  entryVersion!: number;

  @Column({ type: 'jsonb' })
  withdrawnPurposeIds!: string[];

  @Column({ type: 'jsonb' })
  location!: LocationRef;

  @Column({ type: 'text', default: 'pending' })
  status!: FollowupStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text' })
  responsibleRole!: FollowupResponsibleRole;

  @Column({ type: 'jsonb', nullable: true })
  assignee!: FollowupAssignee | null;

  @Column({ type: 'text', nullable: true })
  declaredBy!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  declaredEvidence!: string[];

  @Column({ type: 'text' })
  retentionNote!: string;

  @Column({ type: 'text', default: 'local-sample' })
  mode!: FollowupMode;

  @Column({ type: 'text', default: 'unreviewed-candidate' })
  applicability!: 'unreviewed-candidate';

  @Column({ type: 'jsonb', nullable: true })
  mappingResolution!: { parentTaskId: string } | null;

  @Column({ type: 'jsonb', nullable: true })
  mappedTaskIds!: string[] | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
