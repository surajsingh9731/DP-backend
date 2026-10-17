import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { ConsentOfferItem, ConsentReceiptView } from "@sahmati/contracts";
import { ConsentService } from "../services/consent.service";
import { RecordChoicesDto } from "../dto/record-choices.dto";
import { WithdrawChoicesDto } from "../dto/withdraw-choices.dto";
import { Public } from "../../common/decorators/public.decorator";
import { ParticipantSessionGuard } from "../../common/guards/participant-session.guard";
import { CurrentParticipant } from "../../common/decorators/current-participant.decorator";
import type { AuthenticatedParticipant } from "../../common/guards/participant-session.guard";

@Controller("public/:orgSlug/consent")
export class PublicConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Public()
  @Get("offer")
  offer(
    @Param("orgSlug") orgSlug: string,
  ): Promise<{ available: boolean; purposes: ConsentOfferItem[] }> {
    return this.consent.offerForSlug(orgSlug);
  }

  @Public()
  @UseGuards(ParticipantSessionGuard)
  @Post("choices")
  record(
    @Body() dto: RecordChoicesDto,
    @CurrentParticipant() participant: AuthenticatedParticipant,
  ): Promise<ConsentReceiptView> {
    return this.consent.recordChoices(dto, participant);
  }

  @Public()
  @UseGuards(ParticipantSessionGuard)
  @Post("withdraw")
  withdraw(
    @Body() dto: WithdrawChoicesDto,
    @CurrentParticipant() participant: AuthenticatedParticipant,
  ): Promise<ConsentReceiptView> {
    return this.consent.withdraw(dto, participant);
  }
}
