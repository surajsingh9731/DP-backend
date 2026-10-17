import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type {
  RegisterStatus,
  RegisterSourcePack,
  RegisterStorageReference,
  RegisterVendorReference,
} from '@sahmati/contracts';

/**
 * One data-processing activity entry in the branch's register (module B).
 * `version` backs optimistic concurrency: every PATCH must supply the
 * version it read, or the write is rejected with 409 rather than silently
 * overwriting a concurrent edit.
 */
@Entity({ name: 'register_entries' })
@Index(['tenantId'])
export class RegisterEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text', default: 'draft' })
  status!: RegisterStatus;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  purposeEn!: string;

  @Column({ type: 'text' })
  purposeHi!: string;

  @Column({ type: 'jsonb' })
  dataCategories!: string[];

  @Column({ type: 'text' })
  storageLocation!: string;

  @Column({ type: 'text' })
  retentionNote!: string;

  @Column({ type: 'text' })
  contact!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  vendorReferences!: RegisterVendorReference[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  storageReferences!: RegisterStorageReference[];

  @Column({ type: 'boolean', default: false })
  hasPaperRecords!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  sourcePack!: RegisterSourcePack | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
