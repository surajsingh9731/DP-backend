import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { CapturingNotificationChannel } from "./capturing-notification-channel";

const ORIGIN = "http://127.0.0.1:4200";

/**
 * Drives the real signup -> OTP -> verify flow once (no shortcuts, no
 * seeded session) and returns a session cookie usable by later
 * requests in a test. Shared by every module's integration suite so
 * each one doesn't re-implement this four times.
 */
export async function signUpAndGetCookie(
  app: INestApplication,
  email: CapturingNotificationChannel,
  overrides: Partial<{
    organisationName: string;
    sectorPackCode: string;
    ownerDisplayName: string;
    ownerIdentifier: string;
    language: "en" | "hi";
  }> = {},
): Promise<{ cookie: string; organisationId: string }> {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const signupRes = await request(app.getHttpServer())
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({
      organisationName:
        overrides.organisationName ?? `Bright Future Classes ${unique}`,
      sectorPackCode: overrides.sectorPackCode ?? "education",
      ownerDisplayName: overrides.ownerDisplayName ?? "Vikas Kumar",
      ownerIdentifier:
        overrides.ownerIdentifier ?? `owner-${unique}@school.test`,
      language: overrides.language ?? "en",
    });
  if (signupRes.status !== 201) {
    throw new Error(
      `Signup failed: ${signupRes.status} ${JSON.stringify(signupRes.body)}`,
    );
  }

  const verifyRes = await request(app.getHttpServer())
    .post(`/api/auth/challenges/${signupRes.body.data.challengeId}/verify`)
    .set("Origin", ORIGIN)
    .send({ code: email.lastCode() });
  if (verifyRes.status !== 201) {
    throw new Error(
      `Verify failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`,
    );
  }

  const cookie = verifyRes.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("No session cookie returned from verify.");
  return {
    cookie,
    organisationId: verifyRes.body.data.session.organisationId as string,
  };
}
