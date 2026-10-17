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

/**
 * Exercises the real module A (account/access) flow end to end against
 * real PostgreSQL with real row-level security — signup, OTP verify,
 * login, and tenant isolation between two independently created
 * organisations. Only the outbound email/WhatsApp I/O boundary is
 * substituted (see tests/support); everything else — the HTTP layer, the
 * database, the RLS policies — is the real thing.
 */
describe("Auth (module A): real signup/login/verify flow", () => {
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

  it("signs up, delivers a real OTP through the notification channel, and verifies", async () => {
    const signupRes = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .set("Origin", "http://127.0.0.1:4200")
      .send({
        organisationName: "Bright Future Classes",
        sectorPackCode: "education",
        ownerDisplayName: "Vikas Kumar",
        ownerIdentifier: "owner-a@school.test",
        language: "en",
      });
    expect(signupRes.status).toBe(201);
    const { challengeId } = signupRes.body;
    const code = email.lastCode();

    const verifyRes = await request(app.getHttpServer())
      .post(`/api/auth/challenges/${challengeId}/verify`)
      .set("Origin", "http://127.0.0.1:4200")
      .send({ code });
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.session.organisationName).toBe(
      "Bright Future Classes",
    );
    expect(verifyRes.body.session.role).toBe("owner");
    expect(verifyRes.headers["set-cookie"]?.[0]).toMatch(/sahmati_session=/u);
  });

  it("rejects an incorrect code and locks out after too many attempts", async () => {
    const signupRes = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .set("Origin", "http://127.0.0.1:4200")
      .send({
        organisationName: "Lockout Test School",
        sectorPackCode: "education",
        ownerDisplayName: "Owner",
        ownerIdentifier: "owner-lockout@school.test",
        language: "en",
      });
    const { challengeId } = signupRes.body;

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app.getHttpServer())
        .post(`/api/auth/challenges/${challengeId}/verify`)
        .set("Origin", "http://127.0.0.1:4200")
        .send({ code: "000000" });
      expect(res.status).toBe(401);
    }

    const lockedOut = await request(app.getHttpServer())
      .post(`/api/auth/challenges/${challengeId}/verify`)
      .set("Origin", "http://127.0.0.1:4200")
      .send({ code: email.lastCode() });
    expect(lockedOut.status).toBe(401);
    expect(lockedOut.body.message).toMatch(/too many/iu);
  });

  it("logs in a returning user via a fresh OTP challenge", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", "http://127.0.0.1:4200")
      .send({ identifier: "owner-a@school.test", language: "en" });
    expect(loginRes.status).toBe(201);

    const verifyRes = await request(app.getHttpServer())
      .post(`/api/auth/challenges/${loginRes.body.challengeId}/verify`)
      .set("Origin", "http://127.0.0.1:4200")
      .send({ code: email.lastCode() });
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.session.organisationName).toBe(
      "Bright Future Classes",
    );
  });

  it("keeps two organisations fully isolated from each other", async () => {
    const signupB = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .set("Origin", "http://127.0.0.1:4200")
      .send({
        organisationName: "Second School",
        sectorPackCode: "education",
        ownerDisplayName: "Anita Sharma",
        ownerIdentifier: "owner-b@school.test",
        language: "en",
      });
    const verifyB = await request(app.getHttpServer())
      .post(`/api/auth/challenges/${signupB.body.challengeId}/verify`)
      .set("Origin", "http://127.0.0.1:4200")
      .send({ code: email.lastCode() });
    const cookieB = verifyB.headers["set-cookie"][0];

    const meB = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Origin", "http://127.0.0.1:4200")
      .set("Cookie", cookieB);
    expect(meB.status).toBe(200);
    expect(meB.body.tenantId).toBe(verifyB.body.session.organisationId);

    // Prove RLS itself, not just that the app happens to return the right
    // session: as the restricted runtime role, scoped to tenant B, tenant
    // A's branch must not be visible or reachable for a cross-tenant write.
    const client = new Client({
      host: "127.0.0.1",
      port: 5432,
      user: "sahmati_app",
      password: "sahmati_app_dev_password",
      database: "sahmati_test",
    });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL app.tenant_id = '${meB.body.tenantId}'`);
      const visible = await client.query("SELECT name FROM branches");
      expect(visible.rows).toEqual([{ name: "Main" }]);
      const crossTenantUpdate = await client.query(
        `UPDATE branches SET name = 'HACKED' WHERE tenant_id <> '${meB.body.tenantId}'`,
      );
      expect(crossTenantUpdate.rowCount).toBe(0);
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  });
});
