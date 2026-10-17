import { Injectable } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import { AppConfigService } from "../../config/app-config.service";
import type {
  NotificationChannel,
  NotificationMessage,
} from "../notification-channel.port";
import { renderTemplate } from "../templates/render-template";

/**
 * Real SMTP delivery via the dev `itpo_admin` Gmail/Workspace account.
 * Credentials come from SMTP_HOST/PORT/USER/PASS in .env — never
 * hardcoded, never logged. This is the live channel until WhatsApp Cloud
 * API template approval lands (see AppConfigService.whatsappEnabled).
 */
@Injectable()
export class EmailChannelService implements NotificationChannel {
  readonly kind = "email" as const;
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: AppConfigService) {
    const smtp = this.config.smtp;
    this.from = smtp.from;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }

  async send(
    message: NotificationMessage,
  ): Promise<{ deliveredAt: string; providerRef: string | null }> {
    const rendered = renderTemplate(message);
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: rendered.subject,
      text: rendered.body,
    });
    return {
      deliveredAt: new Date().toISOString(),
      providerRef: info.messageId ?? null,
    };
  }
}
