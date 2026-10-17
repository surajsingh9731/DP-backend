import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RetentionHoldScope, RetentionHoldStatus } from '@sahmati/contracts';

/** An owner preservation hold that takes precedence over any retention policy. */
@Entity({ name: 'retention_holds' })
@Index(['tenantId', 'entryId'])
export class RetentionHoldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  entryId!: string;

  @Column({ type: 'text' })
  scope!: RetentionHoldScope;

  @Column({ type: 'text', nullable: true })
  target!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text', default: 'active' })
  status!: RetentionHoldStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
