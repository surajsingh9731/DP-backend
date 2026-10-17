import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { RightsRequestView } from "@sahmati/contracts";
import { RightsService } from "../services/rights.service";
import { SubmitRightsRequestDto } from "../dto/submit-rights-request.dto";
import { Public } from "../../common/decorators/public.decorator";
import { ParticipantSessionGuard } from "../../common/guards/participant-session.guard";
import { CurrentParticipant } from "../../common/decorators/current-participant.decorator";
import type { AuthenticatedParticipant } from "../../common/guards/participant-session.guard";

@Controller("public/:orgSlug/rights")
export class PublicRightsController {
  constructor(private readonly rights: RightsService) {}

  @Public()
  @UseGuards(ParticipantSessionGuard)
  @Post("requests")
  submit(
    @Body() dto: SubmitRightsRequestDto,
    @CurrentParticipant() participant: AuthenticatedParticipant,
  ): Promise<RightsRequestView> {
    return this.rights.submit(dto, participant);
  }

  @Public()
  @UseGuards(ParticipantSessionGuard)
  @Get("requests")
  myRequests(
    @CurrentParticipant() participant: AuthenticatedParticipant,
  ): Promise<RightsRequestView[]> {
    return this.rights.myRequests(participant);
  }
}
