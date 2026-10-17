import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { ConsentOffer } from '@sahmati/contracts';
@Entity({ schema: 'workspace', name: 'consent_offers', synchronize: false })
export class ConsentOfferEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;
  @Column({ name: 'branch_id', type: 'uuid' }) branchId!: string;
  @Column({ name: 'notice_id', type: 'uuid' }) noticeId!: string;
  @Column({ name: 'version', type: 'integer' }) version!: number;
  @Column({ name: 'data', type: 'jsonb' }) data!: ConsentOffer;
}
