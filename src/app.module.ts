import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { SectorPacksModule } from "./sector-packs/sector-packs.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuthModule } from "./auth/auth.module";
import { RegisterModule } from "./register/register.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CommonModule,
    SectorPacksModule,
    NotificationsModule,
    AuthModule,
    RegisterModule,
  ],
})
export class AppModule {}
