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
import { slugify, verifyAsParticipant } from "../support/participant";

const ORIGIN = "http://127.0.0.1:4200";

describe("Consent (modules D/F): real participant capture, ledger, withdrawal", () => {
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

  async function setUpPublishedOrg(orgName: string) {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: orgName,
    });
    const created = await request(app.getHttpServer())
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
        idempotencyKey: `consent-setup-${orgName}`,
      });
    await request(app.getHttpServer())
      .post("/api/notices/publish")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: `consent-publish-${orgName}` });
    return {
      cookie,
      slug: slugify(orgName),
      registerEntryId: created.body.id as string,
    };
  }

  it("records a real participant's choices with no staff account, and they land in the staff ledger", async () => {
    const orgName = `Consent Flow School ${Date.now()}`;
    const { cookie, slug, registerEntryId } = await setUpPublishedOrg(orgName);

    const offer = await request(app.getHttpServer()).get(
      `/api/public/${slug}/consent/offer`,
    );
    expect(offer.status).toBe(200);
    expect(offer.body.available).toBe(true);
    expect(offer.body.purposes).toHaveLength(1);
    expect(offer.body.purposes[0].registerEntryId).toBe(registerEntryId);

    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-a@family.test",
    );
    const recordRes = await request(app.getHttpServer())
      .post(`/api/public/${slug}/consent/choices`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        choices: [{ registerEntryId, decision: "accept" }],
        idempotencyKey: "record-1",
      });
    expect(recordRes.status).toBe(201);
    expect(recordRes.body.kind).toBe("choices_recorded");
    expect(recordRes.body.previousReceiptHash).toBeNull();

    const ledger = await request(app.getHttpServer())
      .get("/api/consent/ledger")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(ledger.status).toBe(200);
    expect(ledger.body).toHaveLength(1);
    expect(ledger.body[0].identifierMasked).toBe("p***@family.test");
  });

  it("rejects consent to an unknown purpose", async () => {
    const orgName = `Consent Reject School ${Date.now()}`;
    const { slug } = await setUpPublishedOrg(orgName);
    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-b@family.test",
    );
    const res = await request(app.getHttpServer())
      .post(`/api/public/${slug}/consent/choices`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        choices: [
          {
            registerEntryId: "00000000-0000-0000-0000-000000000000",
            decision: "accept",
          },
        ],
        idempotencyKey: "record-reject-1",
      });
    expect(res.status).toBe(400);
  });

  it("withdraws consent, chains the receipt hash, and opens a follow-up task for staff", async () => {
    const orgName = `Consent Withdraw School ${Date.now()}`;
    const { cookie, slug, registerEntryId } = await setUpPublishedOrg(orgName);
    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-c@family.test",
    );

    const recorded = await request(app.getHttpServer())
      .post(`/api/public/${slug}/consent/choices`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        choices: [{ registerEntryId, decision: "accept" }],
        idempotencyKey: "withdraw-record-1",
      });

    const withdrawn = await request(app.getHttpServer())
      .post(`/api/public/${slug}/consent/withdraw`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        registerEntryIds: [registerEntryId],
        idempotencyKey: "withdraw-1",
      });
    expect(withdrawn.status).toBe(201);
    expect(withdrawn.body.kind).toBe("choices_withdrawn");
    expect(withdrawn.body.previousReceiptHash).toBe(recorded.body.receiptHash);

    const followups = await request(app.getHttpServer())
      .get("/api/consent/followups")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(followups.status).toBe(200);
    expect(followups.body).toHaveLength(1);
    expect(followups.body[0].receiptId).toBe(withdrawn.body.id);

    const closed = await request(app.getHttpServer())
      .post(`/api/consent/followups/${followups.body[0].id}/close`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(closed.status).toBe(201);

    const afterClose = await request(app.getHttpServer())
      .get("/api/consent/followups")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(afterClose.body).toHaveLength(0);
  });

  it("refuses a participant bearer token for a different organisation's consent form", async () => {
    const orgA = await setUpPublishedOrg(`Isolated Consent A ${Date.now()}`);
    const orgB = await setUpPublishedOrg(`Isolated Consent B ${Date.now()}`);
    const tokenForA = await verifyAsParticipant(
      app,
      email,
      orgA.slug,
      "cross-org-parent@family.test",
    );

    // Submitting A's token against B's consent endpoint: the token resolves
    // to tenant A regardless of which org slug is in the URL, so B's
    // register entry id is correctly rejected as unknown.
    const res = await request(app.getHttpServer())
      .post(`/api/public/${orgB.slug}/consent/choices`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${tokenForA}`)
      .send({
        choices: [
          { registerEntryId: orgB.registerEntryId, decision: "accept" },
        ],
        idempotencyKey: "cross-org-1",
      });
    expect(res.status).toBe(400);
  });
});
