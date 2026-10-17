import type { RegisterData } from '@sahmati/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'register_entries', synchronize: false })
export class RegisterEntryEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'status', type: 'text' }) status!: 'draft';
  @Column({ name: 'data', type: 'jsonb' }) data!: RegisterData;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
