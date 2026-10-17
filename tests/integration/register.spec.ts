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

describe("Register (module B): data register against real Postgres", () => {
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

  it("exposes the active sector pack's data categories as context", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      ownerIdentifier: "ctx-owner@school.test",
    });
    const res = await request(app.getHttpServer())
      .get("/api/register/context")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.sectorPackCode).toBe("education");
    expect(
      res.body.dataCategories.some(
        (c: { code: string }) => c.code === "student_profile",
      ),
    ).toBe(true);
  });

  it("creates an entry, suggests the pack's legal basis, and flags an override", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      ownerIdentifier: "create-owner@school.test",
    });

    const created = await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "cctv",
        purposeEn: "Campus safety monitoring",
        purposeHi: "परिसर सुरक्षा निगरानी",
        legalBasis: "consent",
        legalBasisReason:
          "Local policy requires explicit consent even for safety footage.",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [
          { name: "Main gate DVR", location: "Server room", medium: "digital" },
        ],
        idempotencyKey: "create-cctv-1",
      });

    expect(created.status).toBe(201);
    expect(created.body.suggestedLegalBasis).toBe("legitimate_use");
    expect(created.body.legalBasis).toBe("consent");
    expect(created.body.legalBasisOverridden).toBe(true);
    expect(created.body.retentionDays).toBe(30);

    const listRes = await request(app.getHttpServer())
      .get("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it("rejects a stale update with a version conflict", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      ownerIdentifier: "conflict-owner@school.test",
    });
    const created = await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "photos",
        purposeEn: "Yearbook photos",
        purposeHi: "वार्षिक पुस्तिका तस्वीरें",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "create-photos-1",
      });

    const staleUpdate = await request(app.getHttpServer())
      .put(`/api/register/${created.body.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "photos",
        purposeEn: "Yearbook photos (updated)",
        purposeHi: "वार्षिक पुस्तिका तस्वीरें (अपडेट किया गया)",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        version: created.body.version + 1,
        idempotencyKey: "update-photos-1",
      });
    expect(staleUpdate.status).toBe(409);

    const realUpdate = await request(app.getHttpServer())
      .put(`/api/register/${created.body.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "photos",
        purposeEn: "Yearbook photos (updated)",
        purposeHi: "वार्षिक पुस्तिका तस्वीरें (अपडेट किया गया)",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        version: created.body.version,
        idempotencyKey: "update-photos-2",
      });
    expect(realUpdate.status).toBe(200);
    expect(realUpdate.body.version).toBe(2);
    expect(realUpdate.body.purposeEn).toBe("Yearbook photos (updated)");

    const detail = await request(app.getHttpServer())
      .get(`/api/register/${created.body.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(detail.status).toBe(200);
    expect(
      detail.body.history.map((h: { action: string }) => h.action),
    ).toEqual(["created", "updated"]);
  });

  it("keeps register entries isolated between organisations", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: "Org A School",
      ownerIdentifier: "org-a@school.test",
    });
    await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({
        categoryCode: "marks",
        purposeEn: "Report cards",
        purposeHi: "रिपोर्ट कार्ड",
        legalBasis: "consent",
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: "org-a-entry-1",
      });

    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: "Org B School",
      ownerIdentifier: "org-b@school.test",
    });
    const orgBList = await request(app.getHttpServer())
      .get("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(orgBList.status).toBe(200);
    expect(orgBList.body).toHaveLength(0);
  });
});
