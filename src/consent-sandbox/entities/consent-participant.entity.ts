import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A single generated synthetic-adult session exercising one offer. */
@Entity({ name: 'consent_participants' })
@Index(['tenantId'])
export class ConsentParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  offerId!: string;

  @Column({ type: 'text' })
  syntheticReference!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  version!: number;

  @Column({ type: 'boolean', default: false })
  ended!: boolean;
}
