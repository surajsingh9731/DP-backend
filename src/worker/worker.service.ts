import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../database/database.service.js';
import { MESSAGE_CHANNEL, type MessageChannel } from './channel.js';
import { WorkerRepository } from './worker.repository.js';
import type { Claimed } from './worker.types.js';
@Injectable()
export class DeliveryWorker {
  private readonly logger = new Logger('DeliveryWorker');
  constructor(
    private readonly db: Database,
    @Inject(MESSAGE_CHANNEL) private readonly channel: MessageChannel,
    private readonly repository: WorkerRepository,
  ) {}
  async claim(tenantId: string | null): Promise<Claimed | null> {
    return this.db.transaction(tenantId, async (client) => {
      await this.repository.expireExhausted(client, tenantId);
      const message = await this.repository.next(client, tenantId);
      if (!message) return null;
      const lease = randomUUID();
      await this.repository.lease(client, tenantId, message.id, lease);
      return { ...message, lease, tenantId, attempts: message.attempts + 1 };
    });
  }
  async deliver(claim: Claimed): Promise<void> {
    try {
      await this.db.transaction(claim.tenantId, async (client) => {
        if (!(await this.repository.lockCurrent(client, claim))) return;
        if (!claim.tenantId) {
          if (!(await this.repository.validLogin(client, claim.id))) {
            await this.repository.finish(client, claim, 'failed');
            return;
          }
        } else if (!(await this.repository.activeTask(client, claim.id))) {
          await this.repository.finish(client, claim, 'cancelled');
          return;
        }
        await this.channel.deliver(client, claim);
        await this.repository.finish(client, claim, 'sent');
      });
    } catch {
      await this.db.transaction(claim.tenantId, (client) => this.repository.retry(client, claim));
      this.logger.warn({ event: 'delivery_retry_or_failure', messageId: claim.id });
    }
  }
  async tick(): Promise<number> {
    let processed = 0;
    const login = await this.claim(null);
    if (login) {
      await this.deliver(login);
      processed++;
    }
    const tenants = await this.db.transaction(null, (client) => this.repository.tenants(client));
    for (const tenant of tenants) {
      const claim = await this.claim(tenant.tenantId);
      if (claim) {
        await this.deliver(claim);
        processed++;
      }
    }
    await this.db.transaction(null, (client) => this.repository.heartbeat(client));
    return processed;
  }
}
