import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { EmailChannelService } from "../../src/notifications/channels/email-channel.service";
import { WhatsAppChannelService } from "../../src/notifications/channels/whatsapp-channel.service";
import { WorkerRunnerService } from "../../src/messaging/services/worker-runner.service";
import { CapturingNotificationChannel } from "../support/capturing-notification-channel";
import { signUpAndGetCookie } from "../support/signed-in-request";
import { slugify, verifyAsParticipant } from "../support/participant";

const ORIGIN = "http://127.0.0.1:4200";

describe("Messaging (module M): outbox queue drained by the worker process", () => {
  let app: INestApplication;
  const email = new CapturingNotificationChannel();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailChannelService)
      .useValue(email)
      .overrideProvider(WhatsAppChannelService)
      .useValue(email)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("queues a notification when staff respond to a rights request, and the worker delivers it", async () => {
    const orgName = `Messaging Worker School ${Date.now()}`;
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: orgName,
    });
    const slug = slugify(orgName);
    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-messaging@family.test",
    );

    const submitted = await request(app.getHttpServer())
      .post(`/api/public/${slug}/rights/requests`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "grievance",
        details: "The contact number on the notice is wrong.",
        idempotencyKey: "messaging-submit-1",
      });
    expect(submitted.status).toBe(201);

    const before = email.sent.length;

    const responded = await request(app.getHttpServer())
      .post(`/api/rights/requests/${submitted.body.id}/respond`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        status: "responded",
        responseText: "Fixed — thank you for flagging it.",
        version: submitted.body.version,
        idempotencyKey: "messaging-respond-1",
      });
    expect(responded.status).toBe(201);

    const outboxBeforeDelivery = await request(app.getHttpServer())
      .get("/api/messages/outbox")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(outboxBeforeDelivery.status).toBe(200);
    expect(outboxBeforeDelivery.body).toHaveLength(1);
    expect(outboxBeforeDelivery.body[0].status).toBe("pending");
    expect(outboxBeforeDelivery.body[0].template).toBe("rights_response_ready");
    expect(outboxBeforeDelivery.body[0].recipient).toBe(
      "parent-messaging@family.test",
    );

    // Nothing was actually delivered yet — enqueuing never calls the
    // notification channel directly, only the worker does.
    expect(email.sent.length).toBe(before);

    const worker = app.get(WorkerRunnerService);
    const { processed } = await worker.runOnce();
    // The worker drains every tenant's pending outbox in one pass, so other
    // integration test files' own leftover pending rows (the DB isn't
    // truncated between spec files in a single run) may also get delivered
    // here — assert on this test's own message specifically, not on raw
    // counts that other tenants' traffic could shift.
    expect(processed).toBeGreaterThanOrEqual(1);
    const delivered = email.sent.find(
      (m) => m.to === "parent-messaging@family.test" && m.template === "rights_response_ready",
    );
    expect(delivered).toBeDefined();

    const outboxAfterDelivery = await request(app.getHttpServer())
      .get("/api/messages/outbox")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(outboxAfterDelivery.body[0].status).toBe("sent");
    expect(outboxAfterDelivery.body[0].sentAt).not.toBeNull();
  });
});
