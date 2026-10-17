import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'register_pack_sources', synchronize: false })
export class RegisterPackSourceEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'entry_id', type: 'uuid' }) entryId!: string;
  @Column({ name: 'pack_id', type: 'text' }) packId!: string;
  @Column({ name: 'pack_version', type: 'integer' }) packVersion!: number;
}
