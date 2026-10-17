import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ConsentOfferNotice, ConsentPurpose } from '@sahmati/contracts';

/** A fixed, immutable catalog of purposes offered against one sample notice. */
@Entity({ name: 'consent_offers' })
@Index(['tenantId'])
export class ConsentOfferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text' })
  catalogHash!: string;

  @Column({ type: 'jsonb' })
  notice!: ConsentOfferNotice;

  @Column({ type: 'jsonb' })
  purposes!: ConsentPurpose[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
