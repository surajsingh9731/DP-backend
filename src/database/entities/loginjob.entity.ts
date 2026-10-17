import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'delivery', name: 'login_jobs' })
export class LoginJobEntity {
  @PrimaryColumn('uuid', { name: 'id' }) id!: string;
  @Column('text', { name: 'recipient' }) recipient!: string;
  @Column('text', { name: 'subject' }) subject!: string;
  @Column('text', { name: 'body' }) body!: string;
  @Column('text', { name: 'status', default: 'pending' }) status!: string;
  @Column('integer', { name: 'attempts', default: 0 }) attempts!: number;
  @Column('uuid', { name: 'lease_token', nullable: true }) leaseToken!: string | null;
  @Column('timestamptz', { name: 'lease_until', nullable: true }) leaseUntil!: Date | null;
  @Column('timestamptz', { name: 'available_at', default: () => 'CURRENT_TIMESTAMP' })
  availableAt!: Date;
  @Column('text', { name: 'template_key', default: 'login_code' }) templateKey!: string;
  @Column('integer', { name: 'template_version', default: 1 }) templateVersion!: number;
  @Column('text', { name: 'language', default: 'en' }) language!: string;
}
