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

async function addRegisterEntry(
  app: INestApplication,
  cookie: string,
  idempotencyKey: string,
) {
  return request(app.getHttpServer())
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
      idempotencyKey,
    });
}

describe("Notices (module C): real notice publish + public page", () => {
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

  it("refuses to publish with an empty register", async () => {
    const { cookie } = await signUpAndGetCookie(app, email);
    const res = await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "publish-empty-1" });
    expect(res.status).toBe(400);
  });

  it("publishes a notice composed from the register, and the public page serves it with no login", async () => {
    const orgName = `Public Notice School ${Date.now()}`;
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: orgName,
    });
    await addRegisterEntry(app, cookie, "notice-entry-1");

    const publishRes = await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "publish-1" });
    expect(publishRes.status).toBe(201);
    expect(publishRes.body.data.status).toBe("published");
    expect(publishRes.body.data.bodyEn).toContain("Admissions and attendance");

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "");
    const publicRes = await request(app.getHttpServer()).get(
      `/api/public/${slug}/notice`,
    );
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.available).toBe(true);
    expect(publicRes.body.data.organisationName).toBe(orgName);
    expect(publicRes.body.data.bodyEn).toContain("Admissions and attendance");
  });

  it("returns a generic unavailable response for an unpublished org and an unknown slug alike", async () => {
    await signUpAndGetCookie(app, email, {
      organisationName: "Draft Only School Unique Name",
    });
    const unpublished = await request(app.getHttpServer()).get(
      "/api/public/draft-only-school-unique-name/notice",
    );
    const unknown = await request(app.getHttpServer()).get(
      "/api/public/does-not-exist-at-all/notice",
    );
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.data.available).toBe(false);
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.available).toBe(false);
    expect(Object.keys(unpublished.body.data)).toEqual(
      Object.keys(unknown.body.data),
    );
  });

  it("never serves a different organisation's draft or another tenant's notice", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Isolated School A ${Date.now()}`,
    });
    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Isolated School B ${Date.now()}`,
    });
    await addRegisterEntry(app, orgA.cookie, "notice-isolation-a");
    await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({ idempotencyKey: "publish-isolation-a" });

    const currentForB = await request(app.getHttpServer())
      .get("/api/notices/current")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(currentForB.status).toBe(200);
    expect(currentForB.body.data).toBeNull();
  });
});
