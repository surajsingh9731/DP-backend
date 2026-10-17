import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NoticeEntity } from "./entities/notice.entity";
import { NoticeVersionEntity } from "./entities/notice-version.entity";
import { NoticesService } from "./services/notices.service";
import { NoticesController } from "./controllers/notices.controller";
import { PublicNoticesController } from "./controllers/public-notices.controller";
import { SectorPacksModule } from "../sector-packs/sector-packs.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([NoticeEntity, NoticeVersionEntity]),
    SectorPacksModule,
  ],
  controllers: [NoticesController, PublicNoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
