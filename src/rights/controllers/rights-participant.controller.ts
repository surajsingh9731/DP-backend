import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type {
  ParticipantRightsRequest,
  ParticipantRightsView,
} from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { RightsService } from "../services/rights.service";
import { SubmitRightsDto } from "../dto/submit-rights.dto";

/** Mounted under the consent-sandbox session path — see RightsApi on the frontend. */
@Controller("tenants/:tenantId/consent-sandbox/sessions/:sessionId/requests")
@UseGuards(TenantMembershipGuard)
export class RightsParticipantController {
  constructor(private readonly rights: RightsService) {}

  @Get()
  own(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<ParticipantRightsView> {
    return this.rights.own(tenantId, sessionId);
  }

  @Post()
  submit(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitRightsDto,
  ): Promise<ParticipantRightsRequest> {
    return this.rights.submit(tenantId, sessionId, dto);
  }
}
