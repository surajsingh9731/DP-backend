import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { Client } from "pg";
import { AppModule } from "../../src/app.module";
import { EmailChannelService } from "../../src/notifications/channels/email-channel.service";
import { WhatsAppChannelService } from "../../src/notifications/channels/whatsapp-channel.service";
import { CapturingNotificationChannel } from "../support/capturing-notification-channel";
import { signUpAndGetCookie } from "../support/signed-in-request";

const ORIGIN = "http://127.0.0.1:4200";

describe("Partner portal (module O, R2): cross-tenant multi-client view, branding, commission", () => {
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

  // There's no HTTP invite-staff-to-another-org flow built yet (that's a
  // later pass), so this test creates the second membership directly via
  // an admin connection — the same technique retention.spec.ts already
  // uses to backdate a row the API has no path to produce. Nothing about
  // the module under test is mocked; only the test's own setup step is.
  async function addMembership(
    tenantId: string,
    userId: string,
    role: "staff" | "viewer",
  ): Promise<void> {
    const client = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_DATABASE,
      user: process.env.DB_ADMIN_USERNAME,
      password: process.env.DB_ADMIN_PASSWORD,
    });
    await client.connect();
    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role, verified) VALUES ($1, $2, $3, true)`,
      [tenantId, userId, role],
    );
    await client.end();
  }

  it("lists every organisation a partner has a real membership in, each with its own readiness", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Partner Client A ${Date.now()}`,
      ownerIdentifier: `partner-owner-a-${Date.now()}@school.test`,
    });
    const meA = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie);
    const partnerUserId = meA.body.data.userId as string;

    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Partner Client B ${Date.now()}`,
      ownerIdentifier: `partner-owner-b-${Date.now()}@school.test`,
    });

    await addMembership(orgB.organisationId, partnerUserId, "staff");

    const organisations = await request(app.getHttpServer())
      .get("/api/partner/organisations")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie);
    expect(organisations.status).toBe(200);
    expect(organisations.body.data).toHaveLength(2);

    const asA = organisations.body.data.find(
      (o: { organisationId: string }) =>
        o.organisationId === orgA.organisationId,
    );
    const asB = organisations.body.data.find(
      (o: { organisationId: string }) =>
        o.organisationId === orgB.organisationId,
    );
    expect(asA.role).toBe("owner");
    expect(asB.role).toBe("staff");
    // Readiness for B must reflect B's own real data (register empty so far), not leak A's.
    expect(
      asB.readiness.find((c: { id: string }) => c.id === "register").status,
    ).toBe("danger");
  });

  it("a user with only one membership sees only that one organisation", async () => {
    const solo = await signUpAndGetCookie(app, email, {
      organisationName: `Partner Solo School ${Date.now()}`,
    });
    const organisations = await request(app.getHttpServer())
      .get("/api/partner/organisations")
      .set("Origin", ORIGIN)
      .set("Cookie", solo.cookie);
    expect(organisations.status).toBe(200);
    expect(organisations.body.data).toHaveLength(1);
    expect(organisations.body.data[0].organisationId).toBe(solo.organisationId);
  });

  it("manages a white-label branding profile", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Partner Branding School ${Date.now()}`,
    });

    const empty = await request(app.getHttpServer())
      .get("/api/partner/profile")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toBeNull();

    const created = await request(app.getHttpServer())
      .put("/api/partner/profile")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        brandName: "Compliance Consultants Co",
        contactEmail: "hello@compliance.test",
      });
    expect(created.status).toBe(200);
    expect(created.body.data.brandName).toBe("Compliance Consultants Co");
    expect(created.body.data.version).toBe(1);

    const updated = await request(app.getHttpServer())
      .put("/api/partner/profile")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        brandName: "Compliance Consultants Co (rebrand)",
        contactEmail: "hello@compliance.test",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);
  });

  it("records a commission only for an organisation the partner actually belongs to", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Commission Client A ${Date.now()}`,
      ownerIdentifier: `commission-owner-a-${Date.now()}@school.test`,
    });
    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Commission Client B ${Date.now()}`,
    });

    const rejected = await request(app.getHttpServer())
      .post("/api/partner/commissions")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({ organisationId: orgB.organisationId, amountInr: "5000.00" });
    expect(rejected.status).toBe(400);

    const recorded = await request(app.getHttpServer())
      .post("/api/partner/commissions")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({
        organisationId: orgA.organisationId,
        amountInr: "5000.00",
        note: "Year 1 referral",
      });
    expect(recorded.status).toBe(201);
    expect(recorded.body.data.status).toBe("pending");
    expect(recorded.body.data.organisationName).toContain(
      "Commission Client A",
    );

    const confirmed = await request(app.getHttpServer())
      .put(`/api/partner/commissions/${recorded.body.data.id}/status`)
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({ status: "confirmed" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe("confirmed");

    const list = await request(app.getHttpServer())
      .get("/api/partner/commissions")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });
});
