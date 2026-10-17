import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AppConfigService } from "../../config/app-config.service";
import type {
  NotificationChannel,
  NotificationMessage,
} from "../notification-channel.port";

/**
 * WhatsApp Cloud API adapter. Meta Business verification and template
 * approval are still pending (brief §13 risk — "days to weeks"), so this
 * throws a clear, typed error rather than silently no-op'ing or faking a
 * delivery; MessagesService falls back to EmailChannelService whenever
 * `AppConfigService.whatsappEnabled` is false. No local/mock send path
 * exists here by design — once credentials land, this starts working
 * with no change to any caller.
 */
@Injectable()
export class WhatsAppChannelService implements NotificationChannel {
  readonly kind = "whatsapp" as const;

  constructor(private readonly config: AppConfigService) {}

  async send(
    message: NotificationMessage,
  ): Promise<{ deliveredAt: string; providerRef: string | null }> {
    if (!this.config.whatsappEnabled) {
      throw new ServiceUnavailableException(
        "WhatsApp Cloud API is not configured yet.",
      );
    }
    const { accessToken, phoneNumberId } = this.config.whatsapp;
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: "template",
          template: {
            name: message.template,
            language: { code: message.language === "hi" ? "hi" : "en" },
            components: [
              {
                type: "body",
                parameters: Object.values(message.payload).map((value) => ({
                  type: "text",
                  text: String(value),
                })),
              },
            ],
          },
        }),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `WhatsApp Cloud API delivery failed (${response.status}).`,
      );
    }
    const data = (await response.json()) as { messages?: { id?: string }[] };
    return {
      deliveredAt: new Date().toISOString(),
      providerRef: data.messages?.[0]?.id ?? null,
    };
  }
}
