import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../config/app-config.service";
import { EmailChannelService } from "../channels/email-channel.service";
import { WhatsAppChannelService } from "../channels/whatsapp-channel.service";
import type {
  NotificationChannel,
  NotificationMessage,
} from "../notification-channel.port";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Picks the real channel for a recipient — WhatsApp when the identifier
 * is a phone number and WhatsApp Cloud API is live, email otherwise — and
 * nothing else in the codebase ever imports a concrete channel directly.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly email: EmailChannelService,
    private readonly whatsapp: WhatsAppChannelService,
  ) {}

  channelFor(identifier: string): NotificationChannel {
    const isEmail = EMAIL_RE.test(identifier);
    if (!isEmail && this.config.whatsappEnabled) return this.whatsapp;
    return this.email;
  }

  send(
    message: NotificationMessage,
  ): Promise<{ deliveredAt: string; providerRef: string | null }> {
    return this.channelFor(message.to).send(message);
  }
}
