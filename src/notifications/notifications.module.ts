import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module";
import { EmailChannelService } from "./channels/email-channel.service";
import { WhatsAppChannelService } from "./channels/whatsapp-channel.service";
import { NotificationsService } from "./services/notifications.service";

@Module({
  imports: [AppConfigModule],
  providers: [
    EmailChannelService,
    WhatsAppChannelService,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
