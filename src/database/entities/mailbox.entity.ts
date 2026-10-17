import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ schema: 'delivery', name: 'mailbox' })
export class MailboxEntity {
  @PrimaryColumn('uuid', { name: 'message_id' }) messageId!: string;
  @Column('text', { name: 'recipient' }) recipient!: string;
  @Column('text', { name: 'subject' }) subject!: string;
  @Column('text', { name: 'body' }) body!: string;
  @Column('timestamptz', { name: 'delivered_at', default: () => 'CURRENT_TIMESTAMP' })
  deliveredAt!: Date;
  @Column('text', { name: 'template_key', default: 'legacy_local_message' }) templateKey!: string;
  @Column('integer', { name: 'template_version', default: 1 }) templateVersion!: number;
  @Column('text', { name: 'language', default: 'en' }) language!: string;
}
