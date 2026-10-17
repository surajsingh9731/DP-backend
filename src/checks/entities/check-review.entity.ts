import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { CheckApplicability, CheckAuthenticity, CheckResult, CheckReviewProvenance } from '@sahmati/contracts';

/** One owner/staff manual evidence review against a followup task, at a point in time. */
@Entity({ name: 'check_reviews' })
@Index(['taskId'])
export class CheckReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  taskId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'int' })
  taskVersion!: number;

  @Column({ type: 'text' })
  applicability!: CheckApplicability;

  @Column({ type: 'text' })
  result!: CheckResult;

  @Column({ type: 'text' })
  rationale!: string;

  @Column({ type: 'jsonb' })
  evidenceRefs!: string[];

  @Column({ type: 'text' })
  reviewerId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  reviewedAt!: Date;

  @Column({ type: 'timestamptz' })
  validUntil!: Date;

  @Column({ type: 'text', default: 'synthetic-manual-reference' })
  provenance!: CheckReviewProvenance;

  @Column({ type: 'text', default: 'not-authenticated' })
  authenticity!: CheckAuthenticity;
}
