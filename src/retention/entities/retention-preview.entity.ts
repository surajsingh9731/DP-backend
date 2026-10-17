import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { RetentionFreshness, RetentionIntegrity, RetentionPreviewItem, RetentionPreviewSummary } from '@sahmati/contracts';

/** An immutable dry-run snapshot. Never deletes or redacts anything — see RetentionPreviewPage. */
@Entity({ name: 'retention_previews' })
@Index(['tenantId', 'entryId'])
export class RetentionPreviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  entryId!: string;

  @Column({ type: 'timestamptz' })
  asOf!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  checkedAt!: Date;

  @Column({ type: 'jsonb' })
  items!: RetentionPreviewItem[];

  @Column({ type: 'jsonb' })
  summary!: RetentionPreviewSummary;

  @Column({ type: 'int' })
  entryVersion!: number;

  @Column({ type: 'text' })
  freshness!: RetentionFreshness;

  @Column({ type: 'text' })
  inputHash!: string;

  @Column({ type: 'text' })
  contentHash!: string;

  @Column({ type: 'text' })
  integrity!: RetentionIntegrity;
}
