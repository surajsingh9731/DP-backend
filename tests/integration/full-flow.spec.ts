process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5432";
process.env.DB_USERNAME = "postgres";
process.env.DB_PASSWORD = "postgres";
process.env.DB_DATABASE = "sahmati_test";
process.env.API_PORT = "4301";
process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
process.env.AUTH_PEPPER = "test-pepper-not-for-production";

import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { AppModule } from "../../src/app.module";
import { TenantEntity } from "../../src/auth/entities/tenant.entity";
import { UserEntity } from "../../src/auth/entities/user.entity";
import { MembershipEntity } from "../../src/auth/entities/membership.entity";
import { createOriginCheckMiddleware } from "../../src/bootstrap/origin-check.middleware";

/**
 * End-to-end integration test over a real local PostgreSQL (sahmati_test),
 * running the actual NestJS application (no mocks) through its real HTTP
 * surface with cookie-based sessions — the same path the frontend uses.
 * Mirrors the manual smoke test used to verify this backend during
 * development.
 */
describe("Sahmati API — full flow", () => {
  let app: INestApplication;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(createOriginCheckMiddleware("http://127.0.0.1:4200"));
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Seed one demo tenant + owner, idempotently, via the app's own
    // already-initialized connection (a second DataSource.initialize() in
    // the same process conflicts with TypeORM's global entity metadata).
    const tenants = app.get<Repository<TenantEntity>>(
      getRepositoryToken(TenantEntity),
    );
    const users = app.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    const memberships = app.get<Repository<MembershipEntity>>(
      getRepositoryToken(MembershipEntity),
    );
    let tenant = await tenants.findOne({
      where: { name: "Integration test tenant" },
    });
    if (!tenant)
      tenant = await tenants.save(
        tenants.create({ name: "Integration test tenant", branch: "Main" }),
      );
    tenantId = tenant.id;
    let user = await users.findOne({
      where: { email: "owner@demo.sahmati.test" },
    });
    if (!user)
      user = await users.save(
        users.create({
          email: "owner@demo.sahmati.test",
          displayName: "Demo owner",
        }),
      );
    const existing = await memberships.findOne({
      where: { tenantId, userId: user.id },
    });
    if (!existing)
      await memberships.save(
        memberships.create({ tenantId, userId: user.id, role: "owner" }),
      );
  });

  afterAll(async () => {
    await app.close();
  });

  const agent = () => request(app.getHttpServer());
  const ORIGIN = "http://127.0.0.1:4200";

  it("signs in via local email OTP and establishes a session", async () => {
    const challenge = await agent()
      .post("/api/auth/challenges")
      .set("Origin", ORIGIN)
      .send({ email: "owner@demo.sahmati.test", language: "en" })
      .expect(201);

    const mail = await agent()
      .get("/api/dev/mail")
      .set("Origin", ORIGIN)
      .expect(200);
    const code = /\d{6}/.exec(mail.body[0].body)![0];

    const verify = await agent()
      .post("/api/auth/verify")
      .set("Origin", ORIGIN)
      .send({ challengeId: challenge.body.challengeId, code })
      .expect(201);

    expect(verify.body.signedIn).toBe(true);
    expect(verify.headers["set-cookie"]).toBeDefined();
  });

  it("runs the full register -> notice -> consent -> followup -> checks -> rights -> evidence -> retention flow", async () => {
    const challenge = await agent()
      .post("/api/auth/challenges")
      .set("Origin", ORIGIN)
      .send({ email: "owner@demo.sahmati.test", language: "en" })
      .expect(201);
    const mail = await agent()
      .get("/api/dev/mail")
      .set("Origin", ORIGIN)
      .expect(200);
    const code = /\d{6}/.exec(mail.body[0].body)![0];
    const verify = await agent()
      .post("/api/auth/verify")
      .set("Origin", ORIGIN)
      .send({ challengeId: challenge.body.challengeId, code })
      .expect(201);
    const cookie = verify.headers["set-cookie"];

    const authed = () => ({
      get: (path: string) =>
        agent().get(path).set("Cookie", cookie).set("Origin", ORIGIN),
      post: (path: string) =>
        agent().post(path).set("Cookie", cookie).set("Origin", ORIGIN),
    });

    const me = await authed().get("/api/auth/me").expect(200);
    expect(
      me.body.memberships.some(
        (m: { tenantId: string }) => m.tenantId === tenantId,
      ),
    ).toBe(true);

    const entry = await authed()
      .post(`/api/tenants/${tenantId}/register`)
      .send({
        name: "Admissions",
        purposeEn: "Prepare admissions",
        purposeHi: "प्रवेश",
        dataCategories: ["Contact"],
        storageLocation: "Local",
        retentionNote: "Unreviewed",
        contact: "Front office",
        vendorReferences: [{ name: "CloudMail", service: "Email relay" }],
      })
      .expect(201);

    const notice = await authed()
      .post(`/api/tenants/${tenantId}/notices`)
      .send({
        entryId: entry.body.id,
        entryVersion: entry.body.version,
        language: "en",
        idempotencyKey: `notice-${Date.now()}`,
      })
      .expect(201);
    expect(notice.body.status).toBe("in_review");

    const published = await authed()
      .post(`/api/tenants/${tenantId}/notices/${notice.body.id}/decisions`)
      .send({
        version: notice.body.reviewVersion,
        decision: "publish_sample",
        sampleOnlyAcknowledged: true,
        idempotencyKey: `decide-${Date.now()}`,
      })
      .expect(201);
    expect(published.body.status).toBe("sample_published");

    const offer = await authed()
      .post(`/api/tenants/${tenantId}/consent-sandbox/offers`)
      .send({
        noticeId: notice.body.id,
        purposes: [{ id: "p1", labelEn: "Updates", labelHi: "समाचार" }],
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `offer-${Date.now()}`,
      })
      .expect(201);

    const session = await authed()
      .post(`/api/tenants/${tenantId}/consent-sandbox/sessions`)
      .send({ offerId: offer.body.id })
      .expect(201);

    await authed()
      .post(
        `/api/tenants/${tenantId}/consent-sandbox/sessions/${session.body.id}/choices`,
      )
      .send({
        offerId: offer.body.id,
        offerVersion: offer.body.version,
        catalogHash: offer.body.catalogHash,
        choices: [{ purposeId: "p1", decision: "allow" }],
        interfaceLanguage: "en",
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `choices-${Date.now()}`,
      })
      .expect(201);

    const withdrawn = await authed()
      .post(
        `/api/tenants/${tenantId}/consent-sandbox/sessions/${session.body.id}/withdraw`,
      )
      .send({
        version: 1,
        purposeIds: ["p1"],
        interfaceLanguage: "en",
        idempotencyKey: `withdraw-${Date.now()}`,
      })
      .expect(201);
    expect(withdrawn.body.kind).toBe("choices_withdrawn");

    const followupTasks = await authed()
      .post(`/api/tenants/${tenantId}/followups/from-receipt`)
      .send({
        receiptId: withdrawn.body.id,
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `ff-${Date.now()}`,
      })
      .expect(201);
    expect(followupTasks.body.length).toBeGreaterThan(0);
    const task = followupTasks.body[0];

    const declared = await authed()
      .post(`/api/tenants/${tenantId}/followups/${task.id}/actions`)
      .send({
        action: "declare_complete",
        version: task.version,
        note: "Done",
        evidenceRefs: ["sample-evidence:done"],
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `ff-action-${Date.now()}`,
      })
      .expect(201);
    expect(declared.body.status).toBe("completion_declared");

    const evaluation = await authed()
      .post(`/api/tenants/${tenantId}/checks/tasks/${task.id}/evaluations`)
      .send({
        taskVersion: declared.body.version,
        reviewVersion: 0,
        idempotencyKey: `eval-${Date.now()}`,
      })
      .expect(201);
    expect(evaluation.body.checks.length).toBeGreaterThan(0);

    const rightsRequest = await authed()
      .post(
        `/api/tenants/${tenantId}/consent-sandbox/sessions/${session.body.id}/requests`,
      )
      .send({
        kind: "access",
        inputLanguage: "en",
        details: "Please show my data.",
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `rights-${Date.now()}`,
      })
      .expect(201);
    expect(rightsRequest.body.status).toBe("requested");

    const rightsList = await authed()
      .get(`/api/tenants/${tenantId}/rights`)
      .expect(200);
    expect(rightsList.body.length).toBeGreaterThan(0);

    const evidence = await authed()
      .get(`/api/tenants/${tenantId}/evidence`)
      .expect(200);
    expect(evidence.body.items.length).toBeGreaterThan(0);

    const policy = await authed()
      .post(`/api/tenants/${tenantId}/retention/policies`)
      .send({
        entryId: entry.body.id,
        entryVersion: entry.body.version,
        name: "Default",
        durationDays: 30,
        rationale: "Unreviewed",
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `policy-${Date.now()}`,
      })
      .expect(201);

    const preview = await authed()
      .post(`/api/tenants/${tenantId}/retention/previews`)
      .send({
        entryId: entry.body.id,
        asOf: new Date().toISOString(),
        syntheticOnlyAcknowledged: true,
        idempotencyKey: `preview-${Date.now()}`,
      })
      .expect(201);
    expect(preview.body.summary).toBeDefined();
    void policy;
  });

  it("rejects an unauthenticated request to a tenant-scoped route", async () => {
    await agent()
      .get(`/api/tenants/${tenantId}/register`)
      .set("Origin", ORIGIN)
      .expect(401);
  });

  it("rejects a mutating request from an unexpected Origin", async () => {
    await agent()
      .post("/api/auth/challenges")
      .set("Origin", "http://evil.example")
      .send({ email: "owner@demo.sahmati.test", language: "en" })
      .expect(403);
  });
});
