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

/**
 * R2: health and employer sector packs, added as pure data (one JSON file
 * + one manifest line each — see src/sector-packs/data/manifest.ts). This
 * suite is the proof that no register/notices engine code needed to
 * change: an organisation on either pack gets a real, working register
 * context and can publish a real notice using only its own pack's data.
 */
describe("Sector packs (R2): health and employer, added as pure data", () => {
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

  it("signs up a clinic on the health pack and exposes its own data categories as register context", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Riverside Clinic ${Date.now()}`,
      sectorPackCode: "health",
      ownerIdentifier: `health-owner-${Date.now()}@clinic.test`,
    });

    const context = await request(app.getHttpServer())
      .get("/api/register/context")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(context.status).toBe(200);
    expect(context.body.data.sectorPackCode).toBe("health");
    expect(
      context.body.data.dataCategories.some(
        (c: { code: string }) => c.code === "medical_history",
      ),
    ).toBe(true);
    expect(
      context.body.data.dataCategories.some(
        (c: { code: string }) => c.code === "lab_reports",
      ),
    ).toBe(true);

    const entry = await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "medical_history",
        purposeEn: "Ongoing treatment records",
        purposeHi: "चल रहे उपचार के रिकॉर्ड",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "health-pack-entry-1",
      });
    expect(entry.status).toBe(201);
    expect(entry.body.data.suggestedLegalBasis).toBe("consent");
    expect(entry.body.data.retentionDays).toBe(2555);

    const publish = await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "health-pack-publish-1" });
    expect(publish.status).toBe(201);
    expect(publish.body.data.bodyEn).toContain("sensitive personal data");
  });

  it("signs up an employer on the employer pack, with employee data defaulting to legitimate_use", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Acme Staffing ${Date.now()}`,
      sectorPackCode: "employer",
      ownerIdentifier: `employer-owner-${Date.now()}@acme.test`,
    });

    const context = await request(app.getHttpServer())
      .get("/api/register/context")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(context.status).toBe(200);
    expect(context.body.data.sectorPackCode).toBe("employer");
    expect(
      context.body.data.dataCategories.find(
        (c: { code: string }) => c.code === "employee_profile",
      )?.suggestedLegalBasis,
    ).toBe("legitimate_use");

    const entry = await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "employee_profile",
        purposeEn: "Payroll and attendance",
        purposeHi: "वेतन और उपस्थिति",
        legalBasis: "legitimate_use",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "employer-pack-entry-1",
      });
    expect(entry.status).toBe(201);
    expect(entry.body.data.legalBasisOverridden).toBe(false);

    const publish = await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "employer-pack-publish-1" });
    expect(publish.status).toBe(201);
    expect(publish.body.data.bodyEn).toContain("Aadhaar numbers are masked");
  });
});
