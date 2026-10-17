import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { RegisterData } from '@sahmati/contracts';

/** Immutable snapshot of a register entry as it stood after each save. */
@Entity({ name: 'register_revisions' })
@Index(['entryId'])
export class RegisterRevisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  entryId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'jsonb' })
  data!: RegisterData;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
