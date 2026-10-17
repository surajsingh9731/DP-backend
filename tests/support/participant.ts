import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { CapturingNotificationChannel } from "./capturing-notification-channel";

const ORIGIN = "http://127.0.0.1:4200";

/** Drives the real participant OTP verification flow once and returns a bearer token. */
export async function verifyAsParticipant(
  app: INestApplication,
  email: CapturingNotificationChannel,
  orgSlug: string,
  identifier: string,
): Promise<string> {
  const startRes = await request(app.getHttpServer())
    .post(`/api/public/${orgSlug}/verify/start`)
    .set("Origin", ORIGIN)
    .send({ identifier, language: "en" });
  if (startRes.status !== 201) {
    throw new Error(
      `Verification start failed: ${startRes.status} ${JSON.stringify(startRes.body)}`,
    );
  }

  const confirmRes = await request(app.getHttpServer())
    .post(
      `/api/public/${orgSlug}/verify/${startRes.body.data.verificationId}/confirm`,
    )
    .set("Origin", ORIGIN)
    .send({ code: email.lastCode() });
  if (confirmRes.status !== 201) {
    throw new Error(
      `Verification confirm failed: ${confirmRes.status} ${JSON.stringify(confirmRes.body)}`,
    );
  }
  return confirmRes.body.data.token as string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}
