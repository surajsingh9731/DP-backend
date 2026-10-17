process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5432";
process.env.DB_USERNAME = "postgres";
process.env.DB_PASSWORD = "postgres";
process.env.DB_DATABASE = "sahmati_test";
process.env.API_PORT = "4302";
process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
process.env.AUTH_PEPPER = "test-pepper-not-for-production";

import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { WorkerModule } from "../../src/worker/worker.module";
import { WorkerRunnerService } from "../../src/worker/services/worker-runner.service";
import { MessagesService } from "../../src/messages/services/messages.service";
import { MessageOutboxEntity } from "../../src/messages/entities/message-outbox.entity";
import { MailboxService } from "../../src/local/services/mailbox.service";
import { TenantEntity } from "../../src/auth/entities/tenant.entity";

/**
 * Exercises the delivery worker directly against a real local PostgreSQL:
 * enqueue a message the way a feature service does, run exactly one worker
 * tick, and confirm it was leased, delivered to the local mail sink, and
 * marked sent — the same pipeline verified manually via the HTTP API.
 */
describe("Delivery worker", () => {
  let app: INestApplication;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule, TypeOrmModule.forFeature([TenantEntity])],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const tenants = app.get<Repository<TenantEntity>>(
      getRepositoryToken(TenantEntity),
    );
    let tenant = await tenants.findOne({
      where: { name: "Worker test tenant" },
    });
    if (!tenant)
      tenant = await tenants.save(
        tenants.create({ name: "Worker test tenant", branch: "Main" }),
      );
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("delivers a queued message and marks it sent", async () => {
    const messages = app.get(MessagesService);
    const runner = app.get(WorkerRunnerService);
    const outbox = app.get<Repository<MessageOutboxEntity>>(
      getRepositoryToken(MessageOutboxEntity),
    );
    const mailbox = app.get(MailboxService);

    const before = (await mailbox.list()).length;
    await messages.enqueue(
      tenantId,
      "owner@demo.sahmati.test",
      "task_created",
      "en",
      {
        taskId: "test-task-id",
      },
    );

    const delivered = await runner.tick();
    expect(delivered).toBeGreaterThanOrEqual(1);

    const after = await mailbox.list();
    expect(after.length).toBeGreaterThan(before);
    expect(after[0]!.subject).toBe("New review task created");

    const counts = await messages.counts(tenantId);
    expect(counts.sent).toBeGreaterThanOrEqual(1);

    const row = await outbox.findOne({
      where: { tenantId, template: "task_created" },
      order: { createdAt: "DESC" },
    });
    expect(row?.status).toBe("sent");
    expect(row?.sentAt).not.toBeNull();
  });

  it("does not redeliver an already-leased row within its lease window", async () => {
    const messages = app.get(MessagesService);
    const runner = app.get(WorkerRunnerService);
    await messages.enqueue(
      tenantId,
      "owner@demo.sahmati.test",
      "task_created",
      "en",
      {
        taskId: "second-task",
      },
    );
    const first = await runner.tick();
    expect(first).toBeGreaterThanOrEqual(1);
    // The row worker just delivered is already 'sent', so an immediate
    // second tick must not re-lease or re-deliver it.
    const second = await runner.tick();
    expect(second).toBe(0);
  });
});
