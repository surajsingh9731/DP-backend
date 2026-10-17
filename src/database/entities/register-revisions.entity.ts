import type { RegisterData } from '@sahmati/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'workspace', name: 'register_revisions', synchronize: false })
export class RegisterRevisionEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'entry_id', type: 'uuid' }) entryId!: string;
  @PrimaryColumn({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: RegisterData;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
