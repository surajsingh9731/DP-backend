import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { LocationRef, RightsWorkItemStatus } from '@sahmati/contracts';

/** One place that may hold data covered by a rights request. */
@Entity({ name: 'rights_work_items' })
@Index(['requestId'])
export class RightsWorkItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requestId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'jsonb' })
  location!: LocationRef;

  @Column({ type: 'text', default: 'pending' })
  status!: RightsWorkItemStatus;

  @Column({ type: 'text', nullable: true })
  declaredBy!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  declaredEvidence!: string[];

  @Column({ type: 'uuid', nullable: true })
  relatedFollowupTaskId!: string | null;
}
