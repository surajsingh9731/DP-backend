export type NotificationRecipientKind = "email" | "whatsapp";

export interface NotificationMessage {
  to: string;
  language: "en" | "hi";
  template: string;
  payload: Record<string, unknown>;
}

/**
 * The seam that keeps Module M's WhatsApp-vs-email decision a DI binding,
 * not a rewrite: every caller depends on this interface, never on a
 * concrete channel. Satisfies OCP (new channel = new implementation, zero
 * changes to callers) and DIP (high-level MessagesService depends on this
 * abstraction, not on nodemailer/WhatsApp Cloud API directly).
 */
export interface NotificationChannel {
  readonly kind: NotificationRecipientKind;
  send(
    message: NotificationMessage,
  ): Promise<{ deliveredAt: string; providerRef: string | null }>;
}

export const NOTIFICATION_CHANNEL_REGISTRY = "NOTIFICATION_CHANNEL_REGISTRY";
