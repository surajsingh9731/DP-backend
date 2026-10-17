import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One owner-reviewed response shown to the participant for a request. */
@Entity({ name: 'rights_responses' })
@Index(['requestId'])
export class RightsResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requestId!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  at!: Date;

  @Column({ type: 'text' })
  language!: 'en' | 'hi';

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text' })
  resolution!: 'complete' | 'partial' | 'blocked';

  @Column({ type: 'int' })
  unresolvedCount!: number;

  @Column({ type: 'int' })
  requestVersion!: number;
}
