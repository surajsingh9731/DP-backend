import { Injectable, Logger } from "@nestjs/common";
import type { Repository } from "typeorm";
import { DataSource } from "typeorm";
import { MessageOutboxEntity } from "../entities/message-outbox.entity";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { NotificationsService } from "../../notifications/services/notifications.service";

const MAX_ATTEMPTS = 5;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * The one piece of src/worker/main.ts's job that's worth unit/integration
 * testing in isolation: draining pending message_outbox rows. Runs as a
 * provider (not tied to the HTTP request lifecycle) so both the standalone
 * worker process and tests can call `runOnce()` directly. Iterates tenants
 * one at a time, each under its own transaction with `app.tenant_id` set —
 * exactly the same RLS-respecting pattern TenantContextInterceptor uses per
 * request, just driven by a poll loop instead of an incoming request.
 */
@Injectable()
export class WorkerRunnerService {
  private readonly logger = new Logger(WorkerRunnerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly notifications: NotificationsService,
  ) {}

  async runOnce(batchSize = 20): Promise<{ processed: number }> {
    const tenants: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM organisations`,
    );
    let processed = 0;
    for (const { id: tenantId } of tenants) {
      processed += await this.processTenant(tenantId, batchSize);
    }
    return { processed };
  }

  private async processTenant(
    tenantId: string,
    batchSize: number,
  ): Promise<number> {
    if (!UUID_RE.test(tenantId)) {
      throw new Error(
        "Organisation id is not a UUID — refusing to interpolate it into SET LOCAL.",
      );
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await queryRunner.query(`SET LOCAL app.participant_session_id = ''`);
      const processed = await this.tenantContext.run(
        { manager: queryRunner.manager, tenantId },
        async () => {
          const repo = queryRunner.manager.getRepository(MessageOutboxEntity);
          const pending = await repo.find({
            where: { tenantId, status: "pending" },
            order: { createdAt: "ASC" },
            take: batchSize,
          });
          for (const row of pending) {
            await this.deliverOne(repo, row);
          }
          return pending.length;
        },
      );
      await queryRunner.commitTransaction();
      return processed;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
