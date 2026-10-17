import { Controller, Get } from "@nestjs/common";
import type { DashboardCheckView } from "@sahmati/contracts";
import { DashboardService } from "../services/dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("readiness")
  readiness(): Promise<DashboardCheckView[]> {
    return this.dashboard.readiness();
  }
}
