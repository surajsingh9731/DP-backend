import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Local development mail sink. No real email is ever sent from this
 * backend (see docs/sources — EMAIL delivery is a local synthetic sink by
 * explicit decision); every "sent" message lands here instead, readable
 * only through /api/dev/mail.
 */
@Entity({ name: 'local_mail' })
export class MailEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  recipient!: string;

  @Column({ type: 'text' })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  deliveredAt!: Date;
}
