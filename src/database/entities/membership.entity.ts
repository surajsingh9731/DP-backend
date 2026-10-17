import type { Role } from '@sahmati/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'identity', name: 'memberships' })
export class MembershipEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' }) tenantId!: string;
  @PrimaryColumn('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'branch_id' }) branchId!: string;
  @Column('text', { name: 'role' }) role!: Role;
  @Column('boolean', { name: 'active', default: true }) active!: boolean;
}
