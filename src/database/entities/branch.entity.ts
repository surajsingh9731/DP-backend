import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'branches' })
export class BranchEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' }) tenantId!: string;
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('text', { name: 'name' }) name!: string;
}
