import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PartnerProfileEntity } from "./entities/partner-profile.entity";
import { CommissionRecordEntity } from "./entities/commission-record.entity";
import { PartnerService } from "./services/partner.service";
import { PartnerController } from "./controllers/partner.controller";
import { DashboardModule } from "../dashboard/dashboard.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PartnerProfileEntity, CommissionRecordEntity]),
    DashboardModule,
  ],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
