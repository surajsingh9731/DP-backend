import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type {
  ContactPreparationData,
  PreparationContactVerification,
  PreparationKind,
  PreparationLegalReviewStatus,
  PreparationStatus,
  RegisterSourcePack,
  TemplatePreparationData,
} from '@sahmati/contracts';

/** An internally reviewed branch draft — a notice template or a privacy contact. */
@Entity({ name: 'preparation_records' })
@Index(['tenantId'])
export class PreparationRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'text' })
  kind!: PreparationKind;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text', default: 'draft' })
  status!: PreparationStatus;

  @Column({ type: 'jsonb' })
  data!: TemplatePreparationData | ContactPreparationData;

  @Column({ type: 'text', default: 'unreviewed' })
  legalReviewStatus!: PreparationLegalReviewStatus;

  @Column({ type: 'text', default: 'unverified' })
  contactVerification!: PreparationContactVerification;

  @Column({ type: 'text' })
  contentHash!: string;

  @Column({ type: 'jsonb', nullable: true })
  sourcePack!: RegisterSourcePack | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
