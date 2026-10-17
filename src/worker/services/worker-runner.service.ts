import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { MessageOutboxEntity } from "../../messages/entities/message-outbox.entity";
import {
  renderMessage,
  type MessageTemplate,
} from "../../messages/services/message-templates";
import { MailboxService } from "../../local/services/mailbox.service";

const BATCH_SIZE = 10;
const LEASE_SECONDS = 30;

/**
 * The delivery worker's own loop. Runs as a separate process
 * (`npm run worker`) from the API, exactly like the handover's own
 * "modular NestJS monolith plus separately launched delivery worker"
 * decision. Leases a bounded batch of pending outbox rows with
 * `FOR UPDATE SKIP LOCKED` so a second worker process (or a retried tick)
 * never double-sends the same row, renders each one, and hands it to the
 * local mail sink — never a real email provider.
 */
@Injectable()
export class WorkerRunnerService {
  private readonly logger = new Logger("WorkerRunner");

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailbox: MailboxService,
  ) {}

  async tick(): Promise<number> {
    const leased = await this.leaseBatch();
    for (const row of leased) {
      await this.deliver(row);
    }
    return leased.length;
  }

  private async leaseBatch(): Promise<MessageOutboxEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(MessageOutboxEntity, "row")
        .where("row.status = :status", { status: "pending" })
        .andWhere("(row.leaseUntil IS NULL OR row.leaseUntil < now())")
        .orderBy("row.createdAt", "ASC")
        .limit(BATCH_SIZE)
        .setLock("pessimistic_write")
        .getMany();
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      await manager
        .createQueryBuilder()
        .update(MessageOutboxEntity)
        .set({
          leaseUntil: new Date(Date.now() + LEASE_SECONDS * 1000),
          attempts: () => '"attempts" + 1',
        })
        .where("id IN (:...ids)", { ids })
        .execute();
      return rows;
    });
  }

  private async deliver(row: MessageOutboxEntity): Promise<void> {
    try {
      const { subject, body } = renderMessage(
        row.template as MessageTemplate,
        row.language,
        row.payload,
      );
      await this.mailbox.deliver(row.recipient, subject, body);
      await this.dataSource
        .createQueryBuilder()
        .update(MessageOutboxEntity)
        .set({ status: "sent", sentAt: new Date() })
        .where("id = :id", { id: row.id })
        .execute();
    } catch (error) {
      this.logger.error(
        `Failed to deliver outbox message ${row.id}: ${String(error)}`,
      );
      await this.dataSource
        .createQueryBuilder()
        .update(MessageOutboxEntity)
        .set({ status: "failed", failureReason: String(error) })
        .where("id = :id", { id: row.id })
        .execute();
    }
  }
}
