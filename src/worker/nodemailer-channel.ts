import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { DatabaseClient } from '../database/database-client.js';
import {
  SMTP_ADDRESS_PATTERN,
  SMTP_MESSAGE_ID_PATTERN,
  SMTP_POLICY,
} from '../constants/smtp.constants.js';
import type { LocalMessage, MessageChannel } from './channel.js';

export interface SmtpChannelConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  approvedRecipients: readonly string[];
}
export interface MailDeliveryResult {
  accepted: readonly (string | { address: string })[];
  rejected: readonly unknown[];
}
export interface MailTransport {
  sendMail(options: SendMailOptions): Promise<MailDeliveryResult>;
}

function validateConfig(config: SmtpChannelConfig): void {
  if (
    !config.host ||
    /[\s/]/.test(config.host) ||
    !Number.isInteger(config.port) ||
    config.port < SMTP_POLICY.minimumPort ||
    config.port > SMTP_POLICY.maximumPort ||
    typeof config.secure !== 'boolean' ||
    !config.username ||
    !config.password ||
    !SMTP_ADDRESS_PATTERN.test(config.from) ||
    !config.approvedRecipients.length ||
    config.approvedRecipients.some((recipient) => !SMTP_ADDRESS_PATTERN.test(recipient))
  ) {
    throw new Error('Incomplete or invalid approved SMTP configuration');
  }
}

// Deliberately not registered in WorkerModule. Local runtime continues to reject SMTP.
// Production activation also needs outbox send/reconciliation design: SMTP cannot share
// the database transaction and Message-ID alone does not guarantee provider deduplication.
export class NodemailerChannel implements MessageChannel {
  private readonly recipients: ReadonlySet<string>;
  private readonly from: string;
  constructor(
    private readonly transport: MailTransport,
    config: SmtpChannelConfig,
  ) {
    validateConfig(config);
    this.recipients = new Set(config.approvedRecipients);
    this.from = config.from;
  }
  async deliver(_client: DatabaseClient, message: LocalMessage): Promise<void> {
    if (!this.recipients.has(message.recipient)) {
      throw new Error('Recipient has not been approved for SMTP delivery');
    }
    if (!SMTP_MESSAGE_ID_PATTERN.test(message.id) || /[\r\n]/.test(message.subject)) {
      throw new Error('Invalid SMTP message metadata');
    }
    const result = await this.transport.sendMail({
      from: this.from,
      to: message.recipient,
      envelope: { from: this.from, to: [message.recipient] },
      messageId: `<${message.id}@${SMTP_POLICY.messageIdDomain}>`,
      subject: message.subject,
      text: message.body,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (
      result.rejected.length ||
      !result.accepted.some(
        (address) =>
          (typeof address === 'string' ? address : address.address) === message.recipient,
      )
    ) {
      throw new Error('SMTP recipient was not accepted');
    }
  }
}

// Accepts explicit caller-supplied configuration only; never reads process.env,
// credential files, or starts a connection when imported. Not invoked locally.
export function createNodemailerChannel(config: SmtpChannelConfig): NodemailerChannel {
  validateConfig(config);
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.username, pass: config.password },
    tls: { rejectUnauthorized: true },
    connectionTimeout: SMTP_POLICY.connectionTimeoutMs,
    greetingTimeout: SMTP_POLICY.greetingTimeoutMs,
    socketTimeout: SMTP_POLICY.socketTimeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  return new NodemailerChannel(transport, config);
}
