import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import type { BreachIncidentView } from "@sahmati/contracts";
import { BreachService } from "../services/breach.service";
import { ReportBreachDto } from "../dto/report-breach.dto";
import { RecordBreachEventDto } from "../dto/record-breach-event.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("breach")
export class BreachController {
  constructor(private readonly breach: BreachService) {}

  @Get("incidents")
  list(@Query("status") status?: string): Promise<BreachIncidentView[]> {
    return this.breach.list(status);
  }

  @Get("incidents/:id")
  get(@Param("id") id: string): Promise<BreachIncidentView> {
    return this.breach.get(id);
  }

  @Roles("owner", "staff")
  @Post("incidents")
  report(
    @Body() dto: ReportBreachDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<BreachIncidentView> {
    return this.breach.report(dto, session);
  }

  @Roles("owner", "staff")
  @Post("incidents/:id/events")
  recordEvent(
    @Param("id") id: string,
    @Body() dto: RecordBreachEventDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<BreachIncidentView> {
    return this.breach.recordEvent(id, dto, session);
  }
}
