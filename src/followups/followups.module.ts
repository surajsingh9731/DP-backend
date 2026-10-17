import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FollowupTaskEntity } from "./entities/followup-task.entity";
import { FollowupEventEntity } from "./entities/followup-event.entity";
import { FollowupsService } from "./services/followups.service";
import { FollowupsController } from "./controllers/followups.controller";
import { ConsentSandboxModule } from "../consent-sandbox/consent-sandbox.module";
import { NoticesModule } from "../notices/notices.module";
import { RegisterModule } from "../register/register.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([FollowupTaskEntity, FollowupEventEntity]),
    ConsentSandboxModule,
    NoticesModule,
    RegisterModule,
    AuthModule,
  ],
  controllers: [FollowupsController],
  providers: [FollowupsService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
