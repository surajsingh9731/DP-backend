import { Module } from "@nestjs/common";
import { DashboardService } from "./services/dashboard.service";
import { DashboardController } from "./controllers/dashboard.controller";
import { RetentionModule } from "../retention/retention.module";

@Module({
  imports: [RetentionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
