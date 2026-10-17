import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import type { RightsRequestAdminView } from "@sahmati/contracts";
import { RightsService } from "../services/rights.service";
import { RespondRightsRequestDto } from "../dto/respond-rights-request.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("rights")
export class RightsController {
  constructor(private readonly rights: RightsService) {}

  @Get("requests")
  list(@Query("status") status?: string): Promise<RightsRequestAdminView[]> {
    return this.rights.list(status);
  }

  @Roles("owner", "staff")
  @Post("requests/:id/respond")
  respond(
    @Param("id") id: string,
    @Body() dto: RespondRightsRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RightsRequestAdminView> {
    return this.rights.respond(id, dto, session);
  }
}
