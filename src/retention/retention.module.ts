import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RetentionHoldEntity } from "./entities/retention-hold.entity";
import { RetentionActionEntity } from "./entities/retention-action.entity";
import { RetentionAlertEntity } from "./entities/retention-alert.entity";
import { RetentionService } from "./services/retention.service";
import { RetentionSchedulerService } from "./services/retention-scheduler.service";
import { RetentionController } from "./controllers/retention.controller";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RetentionHoldEntity,
      RetentionActionEntity,
      RetentionAlertEntity,
    ]),
    MessagingModule,
  ],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionSchedulerService],
  exports: [RetentionService, RetentionSchedulerService],
})
export class RetentionModule {}
