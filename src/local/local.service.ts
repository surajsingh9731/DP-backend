import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { MailView } from '@sahmati/contracts';
import { LocalRepository } from './local.repository.js';
@Injectable()
export class LocalService {
  constructor(private readonly repository: LocalRepository) {}
  live() {
    return { status: 'ok', mode: 'local', transport: 'database-sink' };
  }
  async ready() {
    try {
      if (!(await this.repository.workerActive()))
        throw new ServiceUnavailableException('Local worker is not ready.');
      return { status: 'ready', database: 'ready', worker: 'active' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Database is unavailable.');
    }
  }
  async mailbox(): Promise<MailView[]> {
    return (await this.repository.mailbox()).map((r) => ({
      id: r.messageId,
      recipient: r.recipient,
      subject: r.subject,
      body: r.body,
      deliveredAt: r.deliveredAt.toISOString(),
    }));
  }
}
