import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { MessageOutboxEntity } from "../entities/message-outbox.entity";
import type { MessageTemplate } from "./message-templates";

export interface DeliveryCounts {
  pending: number;
  sent: number;
  failed: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageOutboxEntity)
    private readonly outbox: Repository<MessageOutboxEntity>,
  ) {}

  /**
   * Queues a notification. Pass the caller's own transaction manager so the
   * enqueue commits atomically with the write it documents — the same
   * pattern as EvidenceLedgerService.append.
   */
  async enqueue(
    tenantId: string,
    recipient: string,
    template: MessageTemplate,
    language: "en" | "hi",
    payload: Record<string, unknown>,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(MessageOutboxEntity)
      : this.outbox;
    await repo.save(
      repo.create({
        tenantId,
        recipient,
        template,
        language,
        payload,
        status: "pending",
      }),
    );
  }

  async counts(tenantId: string): Promise<DeliveryCounts> {
    const rows = await this.outbox
      .createQueryBuilder("row")
      .select("row.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("row.tenantId = :tenantId", { tenantId })
      .groupBy("row.status")
      .getRawMany<{ status: string; count: string }>();
    const counts: DeliveryCounts = { pending: 0, sent: 0, failed: 0 };
    for (const row of rows) {
      if (
        row.status === "pending" ||
        row.status === "sent" ||
        row.status === "failed"
      ) {
        counts[row.status] = Number(row.count);
      }
    }
    return counts;
  }
}
