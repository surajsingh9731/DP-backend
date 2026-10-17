import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RetentionPolicyEntity } from "./entities/retention-policy.entity";
import { RetentionHoldEntity } from "./entities/retention-hold.entity";
import { RetentionHistoryEntity } from "./entities/retention-history.entity";
import { RetentionPreviewEntity } from "./entities/retention-preview.entity";
import { RetentionService } from "./services/retention.service";
import { RetentionController } from "./controllers/retention.controller";
import { RegisterModule } from "../register/register.module";
import { ConsentSandboxModule } from "../consent-sandbox/consent-sandbox.module";
import { NoticesModule } from "../notices/notices.module";
import { RightsModule } from "../rights/rights.module";
import { FollowupsModule } from "../followups/followups.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RetentionPolicyEntity,
      RetentionHoldEntity,
      RetentionHistoryEntity,
      RetentionPreviewEntity,
    ]),
    RegisterModule,
    ConsentSandboxModule,
    NoticesModule,
    RightsModule,
    FollowupsModule,
  ],
  controllers: [RetentionController],
  providers: [RetentionService],
})
export class RetentionModule {}
