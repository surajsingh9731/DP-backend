import type { RegisterData } from '@sahmati/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'setup_drafts', synchronize: false })
export class SetupDraftEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'organisation_name', type: 'text' }) organisationName!: string;
  @Column({ name: 'pack_id', type: 'text' }) packId!: string;
  @Column({ name: 'pack_version', type: 'integer' }) packVersion!: number;
  @Column({ name: 'step', type: 'integer' }) step!: 1 | 2 | 3;
  @Column({ name: 'draft', type: 'jsonb', nullable: true }) draft!: RegisterData | null;
  @Column({ name: 'status', type: 'text' }) status!: 'draft' | 'completed';
  @Column({ name: 'register_entry_id', type: 'uuid', nullable: true }) registerEntryId!:
    string | null;
  @Column({ name: 'completion_key', type: 'uuid', nullable: true }) completionKey!: string | null;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
