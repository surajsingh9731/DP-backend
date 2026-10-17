import { Injectable } from '@nestjs/common';
import { Database } from '../database/database.service.js';
import { LOCAL_MAILBOX_LIMIT } from '../constants/local.constants.js';
import { MailboxEntity } from '../database/entities/foundation.entities.js';
@Injectable()
export class LocalRepository {
  constructor(private readonly db: Database) {}
  async workerActive(): Promise<boolean> {
    return this.db.transaction(null, async (client) => {
      const result = await client.query<{ active: boolean }>(
        "SELECT last_seen_at>now()-interval '15 seconds' AS active FROM delivery.worker_heartbeat WHERE singleton=true",
      );
      return result.rows[0]?.active ?? false;
    });
  }
  mailbox() {
    return this.db.transaction(null, (client) =>
      client.manager
        .getRepository(MailboxEntity)
        .find({ order: { deliveredAt: 'DESC', messageId: 'ASC' }, take: LOCAL_MAILBOX_LIMIT }),
    );
  }
}
