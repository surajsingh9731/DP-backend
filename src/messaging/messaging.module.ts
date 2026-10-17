import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageOutboxEntity } from "./entities/message-outbox.entity";
import { MessageOutboxService } from "./services/message-outbox.service";
import { WorkerRunnerService } from "./services/worker-runner.service";
import { MessagingController } from "./controllers/messaging.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageOutboxEntity]),
    NotificationsModule,
  ],
  controllers: [MessagingController],
  providers: [MessageOutboxService, WorkerRunnerService],
  exports: [MessageOutboxService, WorkerRunnerService],
})
export class MessagingModule {}
