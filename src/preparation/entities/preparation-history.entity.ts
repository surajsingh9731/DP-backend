import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ContactPreparationData, PreparationStatus, TemplatePreparationData } from '@sahmati/contracts';

/** Immutable full snapshot of a preparation record as it stood after each save/action. */
@Entity({ name: 'preparation_history' })
@Index(['recordId'])
export class PreparationHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  recordId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text' })
  status!: PreparationStatus;

  @Column({ type: 'jsonb' })
  data!: TemplatePreparationData | ContactPreparationData;

  @Column({ type: 'text' })
  contentHash!: string;

  @Column({ type: 'text', default: '' })
  comment!: string;

  @Column({ type: 'text' })
  actorId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
