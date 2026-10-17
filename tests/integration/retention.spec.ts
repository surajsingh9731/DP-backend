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

describe("Retention and erasure (module I): dry-run preview, holds, erasure attestation", () => {
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

  // The register entry's dueAt is `createdAt + retentionDays`. retentionDays
  // itself must be a positive integer (the register DTO's own @Min(1)), so
  // to deterministically produce an *overdue* entry in a test we create one
  // with the minimum retentionDays and then backdate its createdAt directly
  // via an admin (RLS-bypassing) connection — the only way to simulate "time
  // has passed" without actually waiting real days in a test.
  async function backdateCreatedAt(
    registerEntryId: string,
    days: number,
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
      `UPDATE register_entries SET created_at = created_at - interval '${days} days' WHERE id = $1`,
      [registerEntryId],
    );
    await client.end();
  }

  async function createEntry(cookie: string, retentionDays: number) {
    const created = await request(app.getHttpServer())
      .post("/api/register")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        categoryCode: "student_profile",
        purposeEn: "Admissions and attendance",
        purposeHi: "प्रवेश और उपस्थिति",
        legalBasis: "consent",
        retentionDays,
        hasPaperRecords: false,
        vendorReferences: [],
        storageReferences: [],
        idempotencyKey: `retention-entry-${Date.now()}-${Math.random()}`,
      });
    return created.body.data.id as string;
  }

  it("previews an overdue entry (backdated past its retention window), lets a hold suppress it, and releasing the hold restores it", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Retention Preview School ${Date.now()}`,
    });
    const entryId = await createEntry(cookie, 1);
    await backdateCreatedAt(entryId, 2);

    const preview = await request(app.getHttpServer())
      .get("/api/retention/preview")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(preview.status).toBe(200);
    const item = preview.body.data.find(
      (x: { registerEntryId: string }) => x.registerEntryId === entryId,
    );
    expect(item).toBeDefined();
    expect(item.overdue).toBe(true);
    expect(item.onHold).toBe(false);

    const hold = await request(app.getHttpServer())
      .post("/api/retention/holds")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        registerEntryId: entryId,
        reason: "Open grievance under review.",
        idempotencyKey: "hold-1",
      });
    expect(hold.status).toBe(201);
    expect(hold.body.data.status).toBe("active");

    const previewWithHold = await request(app.getHttpServer())
      .get("/api/retention/preview")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    const heldItem = previewWithHold.body.data.find(
      (x: { registerEntryId: string }) => x.registerEntryId === entryId,
    );
    expect(heldItem.overdue).toBe(false);
    expect(heldItem.onHold).toBe(true);

    const blockedErasure = await request(app.getHttpServer())
      .post("/api/retention/erasures")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        registerEntryId: entryId,
        notes: "Attempting erasure while on hold.",
        idempotencyKey: "erasure-blocked",
      });
    expect(blockedErasure.status).toBe(400);

    const release = await request(app.getHttpServer())
      .post(`/api/retention/holds/${hold.body.data.id}/release`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "release-1" });
    expect(release.status).toBe(201);
    expect(release.body.data.status).toBe("released");

    const erasure = await request(app.getHttpServer())
      .post("/api/retention/erasures")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        registerEntryId: entryId,
        notes: "Physical and digital copies destroyed.",
        idempotencyKey: "erasure-1",
      });
    expect(erasure.status).toBe(201);
    expect(erasure.body.data.registerEntryId).toBe(entryId);

    const previewAfterErasure = await request(app.getHttpServer())
      .get("/api/retention/preview")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(
      previewAfterErasure.body.data.find(
        (x: { registerEntryId: string }) => x.registerEntryId === entryId,
      ),
    ).toBeUndefined();
  });

  it("refuses erasure of an entry that has not yet reached its retention window", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Retention Too Early School ${Date.now()}`,
    });
    const entryId = await createEntry(cookie, 3650);

    const res = await request(app.getHttpServer())
      .post("/api/retention/erasures")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        registerEntryId: entryId,
        notes: "Too early.",
        idempotencyKey: "erasure-too-early",
      });
    expect(res.status).toBe(400);
  });
});
