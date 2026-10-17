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
import { CapturingNotificationChannel } from "../support/capturing-notification-channel";
import { signUpAndGetCookie } from "../support/signed-in-request";

const ORIGIN = "http://127.0.0.1:4200";

describe("Breach desk (module H): incident intake, containment, DPDP-mandated notifications", () => {
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

  it("reports an incident and drives it through containment to closure, each step version-checked", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Breach Desk School ${Date.now()}`,
    });

    const reported = await request(app.getHttpServer())
      .post("/api/breach/incidents")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        title: "Laptop with student records stolen",
        description:
          "A staff laptop with an unencrypted export was stolen from a vehicle.",
        discoveredAt: new Date().toISOString(),
        severity: "high",
        affectedDataCategories: ["student_profile"],
        affectedPrincipalsCount: 40,
        idempotencyKey: "breach-report-1",
      });
    expect(reported.status).toBe(201);
    expect(reported.body.data.status).toBe("open");
    expect(reported.body.data.version).toBe(1);

    const contained = await request(app.getHttpServer())
      .post(`/api/breach/incidents/${reported.body.data.id}/events`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        eventType: "contained",
        notes: "Laptop was remotely wiped; device recovered by police.",
        version: reported.body.data.version,
        idempotencyKey: "breach-contain-1",
      });
    expect(contained.status).toBe(201);
    expect(contained.body.data.status).toBe("contained");
    expect(contained.body.data.containmentNotes).toContain("remotely wiped");

    const staleEvent = await request(app.getHttpServer())
      .post(`/api/breach/incidents/${reported.body.data.id}/events`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        eventType: "dpb_notified",
        version: 1,
        idempotencyKey: "breach-dpb-stale",
      });
    expect(staleEvent.status).toBe(409);

    const dpbNotified = await request(app.getHttpServer())
      .post(`/api/breach/incidents/${reported.body.data.id}/events`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        eventType: "dpb_notified",
        version: contained.body.data.version,
        idempotencyKey: "breach-dpb-1",
      });
    expect(dpbNotified.status).toBe(201);
    expect(dpbNotified.body.data.status).toBe("dpb_notified");
    expect(dpbNotified.body.data.dpbNotifiedAt).not.toBeNull();

    const principalsNotified = await request(app.getHttpServer())
      .post(`/api/breach/incidents/${reported.body.data.id}/events`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        eventType: "principals_notified",
        version: dpbNotified.body.data.version,
        idempotencyKey: "breach-principals-1",
      });
    expect(principalsNotified.status).toBe(201);
    expect(principalsNotified.body.data.principalsNotifiedAt).not.toBeNull();

    const closed = await request(app.getHttpServer())
      .post(`/api/breach/incidents/${reported.body.data.id}/events`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        eventType: "closed",
        version: principalsNotified.body.data.version,
        idempotencyKey: "breach-close-1",
      });
    expect(closed.status).toBe(201);
    expect(closed.body.data.status).toBe("closed");

    const list = await request(app.getHttpServer())
      .get("/api/breach/incidents")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].status).toBe("closed");
  });

  it("isolates incidents per tenant", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Breach Isolated A ${Date.now()}`,
    });
    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Breach Isolated B ${Date.now()}`,
    });

    await request(app.getHttpServer())
      .post("/api/breach/incidents")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({
        title: "Phishing email led to credential exposure",
        description: "A staff member clicked a phishing link.",
        discoveredAt: new Date().toISOString(),
        severity: "medium",
        affectedDataCategories: ["student_profile"],
        idempotencyKey: "breach-isolation-a",
      });

    const listForB = await request(app.getHttpServer())
      .get("/api/breach/incidents")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(listForB.status).toBe(200);
    expect(listForB.body.data).toHaveLength(0);
  });
});
