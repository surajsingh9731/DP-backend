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

describe("Dashboard (module L): live readiness checks across every other module", () => {
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

  it("flags a fresh organisation as not ready, then turns green as the register fills in and the notice publishes", async () => {
    const orgName = `Dashboard School ${Date.now()}`;
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: orgName,
    });

    const freshReadiness = await request(app.getHttpServer())
      .get("/api/dashboard/readiness")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(freshReadiness.status).toBe(200);
    const checks = freshReadiness.body.data as {
      id: string;
      status: string;
      count: number;
    }[];
    expect(checks.map((c) => c.id)).toEqual([
      "register",
      "notice",
      "consent",
      "withdrawal_followups",
      "rights",
      "breach",
      "retention",
      "messaging",
    ]);
    expect(checks.find((c) => c.id === "register")?.status).toBe("danger");
    expect(checks.find((c) => c.id === "notice")?.status).toBe("danger");
    // Nothing is wrong with these yet — they only turn warning/danger once something is actually overdue/open.
    expect(checks.find((c) => c.id === "rights")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "breach")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "retention")?.status).toBe("ok");
    expect(checks.find((c) => c.id === "messaging")?.status).toBe("ok");

    await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "student_profile",
        purposeEn: "Admissions and attendance",
        purposeHi: "प्रवेश और उपस्थिति",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "dashboard-register-1",
      });
    await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "dashboard-publish-1" });

    const readyNow = await request(app.getHttpServer())
      .get("/api/dashboard/readiness")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    const checksNow = readyNow.body.data as {
      id: string;
      status: string;
      count: number;
    }[];
    expect(checksNow.find((c) => c.id === "register")?.status).toBe("ok");
    expect(checksNow.find((c) => c.id === "register")?.count).toBe(1);
    expect(checksNow.find((c) => c.id === "notice")?.status).toBe("ok");
  });

  it("isolates readiness checks per tenant", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Dashboard Isolated A ${Date.now()}`,
    });
    await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({
        categoryCode: "student_profile",
        purposeEn: "Admissions and attendance",
        purposeHi: "प्रवेश और उपस्थिति",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "dashboard-isolation-a",
      });

    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Dashboard Isolated B ${Date.now()}`,
    });
    const readinessForB = await request(app.getHttpServer())
      .get("/api/dashboard/readiness")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    const checksForB = readinessForB.body.data as {
      id: string;
      count: number;
    }[];
    expect(checksForB.find((c) => c.id === "register")?.count).toBe(0);
  });
});
