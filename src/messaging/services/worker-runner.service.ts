import { Injectable, Logger } from "@nestjs/common";
import type { Repository } from "typeorm";
import { MessageOutboxEntity } from "../entities/message-outbox.entity";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { TenantSweepService } from "../../common/services/tenant-sweep.service";
import { NotificationsService } from "../../notifications/services/notifications.service";

const MAX_ATTEMPTS = 5;

/**
 * The one piece of src/worker/main.ts's job that's worth unit/integration
 * testing in isolation: draining pending message_outbox rows. Runs as a
 * provider (not tied to the HTTP request lifecycle) so both the standalone
 * worker process and tests can call `runOnce()` directly. Delegates the
 * per-tenant transaction looping to TenantSweepService, shared with
 * RetentionSchedulerService.
 */
@Injectable()
export class WorkerRunnerService {
  private readonly logger = new Logger(WorkerRunnerService.name);

  constructor(
    private readonly tenantSweep: TenantSweepService,
    private readonly tenantContext: TenantContextService,
    private readonly notifications: NotificationsService,
  ) {}

  async runOnce(batchSize = 20): Promise<{ processed: number }> {
    const counts = await this.tenantSweep.forEachTenant((tenantId) =>
      this.deliverPendingForTenant(tenantId, batchSize),
    );
    return { processed: counts.reduce((sum, count) => sum + count, 0) };
  }

  private async deliverPendingForTenant(
    tenantId: string,
    batchSize: number,
  ): Promise<number> {
    const repo = this.tenantContext.repo(MessageOutboxEntity);
    const pending = await repo.find({
      where: { tenantId, status: "pending" },
      order: { createdAt: "ASC" },
      take: batchSize,
    });
    for (const row of pending) {
      await this.deliverOne(repo, row);
    }
    return pending.length;
  }

  private async deliverOne(
    repo: Repository<MessageOutboxEntity>,
    row: MessageOutboxEntity,
  ): Promise<void> {
    try {
      const result = await this.notifications.send({
        to: row.recipient,
        language: row.language,
        template: row.template,
        payload: row.payload,
      });
      row.status = "sent";
      row.sentAt = new Date(result.deliveredAt);
      row.providerRef = result.providerRef;
    } catch (error) {
      row.attempts += 1;
      row.lastError = error instanceof Error ? error.message : String(error);
      row.status = row.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      this.logger.warn(
        `Delivery attempt ${row.attempts} failed for message ${row.id}: ${row.lastError}`,
      );
    }
    await repo.save(row);
  }
}
