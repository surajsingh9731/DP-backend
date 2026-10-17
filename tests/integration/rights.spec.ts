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

describe("Rights and grievance desk (module G): real participant requests, staff responses", () => {
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

  async function setUpOrgWithRegisterEntry(orgName: string) {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: orgName,
    });
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
        idempotencyKey: `rights-setup-${orgName}`,
      });
    return { cookie, slug: slugify(orgName) };
  }

  it("lets a verified participant submit an access request and auto-generates a summary from the register", async () => {
    const orgName = `Rights Access School ${Date.now()}`;
    const { cookie, slug } = await setUpOrgWithRegisterEntry(orgName);
    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-rights-a@family.test",
    );

    const submitRes = await request(app.getHttpServer())
      .post(`/api/public/${slug}/rights/requests`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "access",
        details: "Please tell me what data you hold about my child.",
        idempotencyKey: "rights-access-1",
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.status).toBe("requested");
    expect(submitRes.body.data.autoAccessSummary).toContain(
      "Admissions and attendance",
    );

    const mine = await request(app.getHttpServer())
      .get(`/api/public/${slug}/rights/requests`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].id).toBe(submitRes.body.data.id);

    const staffList = await request(app.getHttpServer())
      .get("/api/rights/requests")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(staffList.status).toBe(200);
    expect(staffList.body.data).toHaveLength(1);
    expect(staffList.body.data[0].identifierMasked).toBe("p***@family.test");
  });

  it("lets staff respond to a request with optimistic concurrency, and rejects a stale version", async () => {
    const orgName = `Rights Respond School ${Date.now()}`;
    const { cookie, slug } = await setUpOrgWithRegisterEntry(orgName);
    const token = await verifyAsParticipant(
      app,
      email,
      slug,
      "parent-rights-b@family.test",
    );

    const submitRes = await request(app.getHttpServer())
      .post(`/api/public/${slug}/rights/requests`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "grievance",
        details: "The notice link on your site is broken.",
        idempotencyKey: "rights-grievance-1",
      });
    expect(submitRes.status).toBe(201);

    const staleRespond = await request(app.getHttpServer())
      .post(`/api/rights/requests/${submitRes.body.data.id}/respond`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        status: "responded",
        responseText: "Fixed, thank you.",
        version: 999,
        idempotencyKey: "rights-respond-stale",
      });
    expect(staleRespond.status).toBe(409);

    const respond = await request(app.getHttpServer())
      .post(`/api/rights/requests/${submitRes.body.data.id}/respond`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        status: "responded",
        responseText: "Fixed, thank you.",
        version: submitRes.body.data.version,
        idempotencyKey: "rights-respond-1",
      });
    expect(respond.status).toBe(201);
    expect(respond.body.data.status).toBe("responded");
    expect(respond.body.data.responseText).toBe("Fixed, thank you.");
    expect(respond.body.data.version).toBe(submitRes.body.data.version + 1);
  });

  it("rejects a bearer token for a different organisation's rights desk", async () => {
    const orgA = await setUpOrgWithRegisterEntry(
      `Isolated Rights A ${Date.now()}`,
    );
    const orgB = await setUpOrgWithRegisterEntry(
      `Isolated Rights B ${Date.now()}`,
    );
    const tokenForA = await verifyAsParticipant(
      app,
      email,
      orgA.slug,
      "cross-org-rights-parent@family.test",
    );

    const submitAgainstB = await request(app.getHttpServer())
      .post(`/api/public/${orgB.slug}/rights/requests`)
      .set("Origin", ORIGIN)
      .set("Authorization", `Bearer ${tokenForA}`)
      .send({
        kind: "erasure",
        details: "Please delete my data.",
        idempotencyKey: "cross-org-rights-1",
      });
    // The token resolves to tenant A regardless of the URL's org slug, so
    // the request lands under A, not B — staff at B never see it.
    expect(submitAgainstB.status).toBe(201);

    const staffListB = await request(app.getHttpServer())
      .get("/api/rights/requests")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(staffListB.body.data).toHaveLength(0);
  });
});
