import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { SectorPacksModule } from "./sector-packs/sector-packs.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuthModule } from "./auth/auth.module";
import { RegisterModule } from "./register/register.module";
import { NoticesModule } from "./notices/notices.module";
import { ParticipantsModule } from "./participants/participants.module";
import { ConsentModule } from "./consent/consent.module";
import { RightsModule } from "./rights/rights.module";
import { BreachModule } from "./breach/breach.module";
import { RetentionModule } from "./retention/retention.module";
import { MessagingModule } from "./messaging/messaging.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CommonModule,
    SectorPacksModule,
    NotificationsModule,
    AuthModule,
    RegisterModule,
    NoticesModule,
    ParticipantsModule,
    ConsentModule,
    RightsModule,
    BreachModule,
    RetentionModule,
    MessagingModule,
  ],
})
export class AppModule {}
