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

describe("Staff training (module P): lessons, quiz, certificate", () => {
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

  it("starts not_started, moves to in_progress on open, and issues a certificate on a passing quiz", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Training School ${Date.now()}`,
    });

    const freshList = await request(app.getHttpServer())
      .get("/api/training/lessons")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(freshList.status).toBe(200);
    const lesson = freshList.body.data.find(
      (l: { code: string }) => l.code === "dpdp-basics",
    );
    expect(lesson.status).toBe("not_started");
    expect(lesson.certificateId).toBeNull();

    const detail = await request(app.getHttpServer())
      .get("/api/training/lessons/dpdp-basics")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.quiz).toHaveLength(3);
    // The correct-answer index is never sent to the client.
    expect(detail.body.data.quiz[0]).not.toHaveProperty("correctIndex");

    const afterOpen = await request(app.getHttpServer())
      .get("/api/training/lessons")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(
      afterOpen.body.data.find(
        (l: { code: string }) => l.code === "dpdp-basics",
      ).status,
    ).toBe("in_progress");

    // The real correct answers (from src/training/data/lessons.ts): q1->1, q2->0, q3->1.
    const passing = await request(app.getHttpServer())
      .post("/api/training/lessons/dpdp-basics/submit")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ answers: [1, 0, 1] });
    expect(passing.status).toBe(201);
    expect(passing.body.data.passed).toBe(true);
    expect(passing.body.data.score).toBe(100);
    expect(passing.body.data.certificateId).not.toBeNull();

    const certificates = await request(app.getHttpServer())
      .get("/api/training/certificates")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(certificates.status).toBe(200);
    expect(certificates.body.data).toHaveLength(1);
    expect(certificates.body.data[0].lessonCode).toBe("dpdp-basics");
    expect(certificates.body.data[0].certificateId).toBe(
      passing.body.data.certificateId,
    );

    const finalList = await request(app.getHttpServer())
      .get("/api/training/lessons")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie);
    expect(
      finalList.body.data.find(
        (l: { code: string }) => l.code === "dpdp-basics",
      ).status,
    ).toBe("completed");
  });

  it("does not issue a certificate on a failing quiz, and allows a retry", async () => {
    const { cookie } = await signUpAndGetCookie(app, email, {
      organisationName: `Training Retry School ${Date.now()}`,
    });

    const failing = await request(app.getHttpServer())
      .post("/api/training/lessons/dpdp-basics/submit")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ answers: [0, 1, 0] });
    expect(failing.status).toBe(201);
    expect(failing.body.data.passed).toBe(false);
    expect(failing.body.data.certificateId).toBeNull();

    const retry = await request(app.getHttpServer())
      .post("/api/training/lessons/dpdp-basics/submit")
      .set("Origin", ORIGIN)
      .set("Cookie", cookie)
      .send({ answers: [1, 0, 1] });
    expect(retry.status).toBe(201);
    expect(retry.body.data.passed).toBe(true);
    expect(retry.body.data.certificateId).not.toBeNull();
  });

  it("isolates training progress per tenant", async () => {
    const orgA = await signUpAndGetCookie(app, email, {
      organisationName: `Training Isolated A ${Date.now()}`,
    });
    await request(app.getHttpServer())
      .post("/api/training/lessons/dpdp-basics/submit")
      .set("Origin", ORIGIN)
      .set("Cookie", orgA.cookie)
      .send({ answers: [1, 0, 1] });

    const orgB = await signUpAndGetCookie(app, email, {
      organisationName: `Training Isolated B ${Date.now()}`,
    });
    const certificatesForB = await request(app.getHttpServer())
      .get("/api/training/certificates")
      .set("Origin", ORIGIN)
      .set("Cookie", orgB.cookie);
    expect(certificatesForB.status).toBe(200);
    expect(certificatesForB.body.data).toHaveLength(0);
  });
});
