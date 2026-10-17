import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NoticeSnapshotEntity } from "./entities/notice-snapshot.entity";
import { NoticesService } from "./services/notices.service";
import { NoticePdfService } from "./services/notice-pdf.service";
import { NoticesController } from "./controllers/notices.controller";
import { RegisterModule } from "../register/register.module";
import { PreparationModule } from "../preparation/preparation.module";
import { MessagesModule } from "../messages/messages.module";
import { UserEntity } from "../auth/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([NoticeSnapshotEntity, UserEntity]),
    RegisterModule,
    PreparationModule,
    MessagesModule,
  ],
  controllers: [NoticesController],
  providers: [NoticesService, NoticePdfService],
  exports: [NoticesService],
})
export class NoticesModule {}
