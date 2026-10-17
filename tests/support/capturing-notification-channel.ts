import type {
  NotificationChannel,
  NotificationMessage,
} from "../../src/notifications/notification-channel.port";

/**
 * A test double for the ONE external-I/O boundary in the auth flow (real
 * email/WhatsApp delivery). This substitutes `NotificationChannel` at the
 * DI boundary for integration tests only — the application itself never
 * has a mock channel; `EmailChannelService`/`WhatsAppChannelService` are
 * real SMTP/WhatsApp-Cloud-API implementations, exercised directly by a
 * real local SMTP listener when verifying this by hand (see
 * docs/architecture/R1-system-design.md).
 */
export class CapturingNotificationChannel implements NotificationChannel {
  readonly kind = "email" as const;
  readonly sent: NotificationMessage[] = [];

  async send(
    message: NotificationMessage,
  ): Promise<{ deliveredAt: string; providerRef: string | null }> {
    this.sent.push(message);
    return { deliveredAt: new Date().toISOString(), providerRef: null };
  }

  lastCode(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error("No notification was captured.");
    return String(last.payload.code);
  }
}
