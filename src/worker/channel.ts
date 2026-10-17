import { MESSAGE_CHANNEL, SYNTHETIC_RECIPIENTS } from '../constants/delivery.constants.js';
export { MESSAGE_CHANNEL };
import { Injectable } from '@nestjs/common';
import type { DatabaseClient } from '../database/database-client.js';
export interface LocalMessage {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  templateKey: string;
  templateVersion: number;
  language: 'en' | 'hi';
}
export interface MessageChannel {
  deliver(client: DatabaseClient, message: LocalMessage): Promise<void>;
}
export const allowedRecipient = (recipient: string): boolean =>
  SYNTHETIC_RECIPIENTS.includes(recipient);
@Injectable()
export class DatabaseSink implements MessageChannel {
  async deliver(client: DatabaseClient, message: LocalMessage): Promise<void> {
    if (!allowedRecipient(message.recipient))
      throw new Error('Recipient is outside the synthetic local allowlist');
    await client.query(
      'INSERT INTO delivery.mailbox(message_id,recipient,subject,body,template_key,template_version,language) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(message_id) DO NOTHING',
      [
        message.id,
        message.recipient,
        message.subject,
        message.body,
        message.templateKey,
        message.templateVersion,
        message.language,
      ],
    );
  }
}
