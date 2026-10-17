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

describe("Vendor register (module J, R2): agreements and deletion-instruction tracking", () => {
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

  async function createRegisterEntry(cookie: string) {
    const res = await request(app.getHttpServer())
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
        idempotencyKey: `vendor-register-entry-${Date.now()}-${Math.random()}`,
      });
    return res.body.data.id as string;
  }

  it("creates a vendor, drives its agreement from not_sent to signed, and rejects a stale update", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Vendor Agreement School ${Date.now()}`,
    });

    const created = await request(app.getHttpServer())
      .post("/api/vendors")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        name: "CloudMarks Pvt Ltd",
        serviceDescription: "Report card PDF generation and storage.",
        contactEmail: "dpo@cloudmarks.test",
        idempotencyKey: "vendor-create-1",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.agreementStatus).toBe("not_sent");

    const signedTooEarly = await request(app.getHttpServer())
      .post(`/api/vendors/${created.body.data.id}/agreement/signed`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "vendor-signed-too-early" });
    expect(signedTooEarly.status).toBe(400);

    const sent = await request(app.getHttpServer())
      .post(`/api/vendors/${created.body.data.id}/agreement/send`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "vendor-send-1" });
    expect(sent.status).toBe(201);
    expect(sent.body.data.agreementStatus).toBe("sent");

    const signed = await request(app.getHttpServer())
      .post(`/api/vendors/${created.body.data.id}/agreement/signed`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        agreementDocumentRef: "s3://agreements/cloudmarks-2026.pdf",
        idempotencyKey: "vendor-signed-1",
      });
    expect(signed.status).toBe(201);
    expect(signed.body.data.agreementStatus).toBe("signed");
    expect(signed.body.data.agreementDocumentRef).toBe(
      "s3://agreements/cloudmarks-2026.pdf",
    );

    const staleUpdate = await request(app.getHttpServer())
      .put(`/api/vendors/${created.body.data.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        name: "CloudMarks Pvt Ltd (renamed)",
        serviceDescription: "Report card PDF generation and storage.",
        contactEmail: "dpo@cloudmarks.test",
        version: created.body.data.version,
        idempotencyKey: "vendor-update-stale",
      });
    expect(staleUpdate.status).toBe(409);

    const realUpdate = await request(app.getHttpServer())
      .put(`/api/vendors/${created.body.data.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        name: "CloudMarks Pvt Ltd (renamed)",
        serviceDescription: "Report card PDF generation and storage.",
        contactEmail: "dpo@cloudmarks.test",
        version: signed.body.data.version,
        idempotencyKey: "vendor-update-1",
      });
    expect(realUpdate.status).toBe(200);
    expect(realUpdate.body.data.name).toBe("CloudMarks Pvt Ltd (renamed)");

    const list = await request(app.getHttpServer())
      .get("/api/vendors")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("drives a deletion instruction through pending -> acknowledged -> declared_complete, and rejects skipping acknowledgement", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Vendor Deletion School ${Date.now()}`,
    });
    const registerEntryId = await createRegisterEntry(cookie);
    const vendor = await request(app.getHttpServer())
      .post("/api/vendors")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        name: "Archive Co",
        serviceDescription: "Cold storage for scanned admission forms.",
        contactEmail: "privacy@archiveco.test",
        idempotencyKey: "vendor-deletion-create-1",
      });

    const instruction = await request(app.getHttpServer())
      .post("/api/vendors/deletion-instructions")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        vendorId: vendor.body.data.id,
        registerEntryId,
        instructionText:
          "Please delete all scanned admission forms for this entry.",
        idempotencyKey: "deletion-instruction-1",
      });
    expect(instruction.status).toBe(201);
    expect(instruction.body.data.status).toBe("pending");

    const outcomeTooEarly = await request(app.getHttpServer())
      .post(
        `/api/vendors/deletion-instructions/${instruction.body.data.id}/outcome`,
      )
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        outcome: "declared_complete",
        evidenceNote: "Vendor confirmed via email.",
        version: instruction.body.data.version,
        idempotencyKey: "outcome-too-early",
      });
    expect(outcomeTooEarly.status).toBe(400);

    const acknowledged = await request(app.getHttpServer())
      .post(
        `/api/vendors/deletion-instructions/${instruction.body.data.id}/acknowledge`,
      )
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ idempotencyKey: "acknowledge-1" });
    expect(acknowledged.status).toBe(201);
    expect(acknowledged.body.data.status).toBe("acknowledged");

    const outcome = await request(app.getHttpServer())
      .post(
        `/api/vendors/deletion-instructions/${instruction.body.data.id}/outcome`,
      )
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({
        outcome: "declared_complete",
        evidenceNote: "Vendor confirmed deletion via email on 2026-10-17.",
        version: acknowledged.body.data.version,
        idempotencyKey: "outcome-1",
      });
    expect(outcome.status).toBe(201);
    expect(outcome.body.data.status).toBe("declared_complete");
    expect(outcome.body.data.evidenceNote).toContain("confirmed deletion");

    const listForVendor = await request(app.getHttpServer())
      .get(`/api/vendors/deletion-instructions?vendorId=${vendor.body.data.id}`)
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(listForVendor.status).toBe(200);
    expect(listForVendor.body.data).toHaveLength(1);
  });

  it("isolates vendors and deletion instructions per tenant", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Vendor Isolated A ${Date.now()}`,
    });
    await request(app.getHttpServer())
      .post("/api/vendors")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({
        name: "Only Visible To A",
        serviceDescription: "Something A uses.",
        contactEmail: "vendor@a.test",
        idempotencyKey: "vendor-isolation-a",
      });

    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Vendor Isolated B ${Date.now()}`,
    });
    const listForB = await request(app.getHttpServer())
      .get("/api/vendors")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(listForB.status).toBe(200);
    expect(listForB.body.data).toHaveLength(0);
  });
});
