import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import type { MessageOutboxView } from "@sahmati/contracts";
import { MessageOutboxEntity } from "../entities/message-outbox.entity";
import { TenantContextService } from "../../common/services/tenant-context.service";

export interface EnqueueInput {
  tenantId: string;
  recipient: string;
  language: "en" | "hi";
  template: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class MessageOutboxService {
  constructor(private readonly tenantContext: TenantContextService) {}

  /** Enqueues inside the caller's own transaction — never a separate connection. */
  async enqueue(
    manager: EntityManager,
    input: EnqueueInput,
  ): Promise<MessageOutboxEntity> {
    return manager.save(
      manager.create(MessageOutboxEntity, {
        tenantId: input.tenantId,
        recipient: input.recipient,
        language: input.language,
        template: input.template,
        payload: input.payload,
        status: "pending",
      }),
    );
  }

  async list(): Promise<MessageOutboxView[]> {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    const rows = await this.tenantContext
      .repo(MessageOutboxEntity)
      .find({ where: { tenantId }, order: { createdAt: "DESC" } });
    return rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      template: row.template,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
