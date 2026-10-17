import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RetentionPolicyStatus } from '@sahmati/contracts';

/** A draft retention duration for one register entry. Never executes a deletion by itself. */
@Entity({ name: 'retention_policies' })
@Index(['tenantId', 'entryId'])
export class RetentionPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  entryId!: string;

  @Column({ type: 'int' })
  entryVersion!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int' })
  durationDays!: number;

  @Column({ type: 'text' })
  rationale!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: RetentionPolicyStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
