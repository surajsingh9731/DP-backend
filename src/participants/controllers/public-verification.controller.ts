import { Body, Controller, Param, Post } from "@nestjs/common";
import type {
  ParticipantChallengeView,
  ParticipantSessionView,
} from "@sahmati/contracts";
import { ParticipantVerificationService } from "../services/participant-verification.service";
import { StartVerificationDto } from "../dto/start-verification.dto";
import { ConfirmVerificationDto } from "../dto/confirm-verification.dto";
import { Public } from "../../common/decorators/public.decorator";

/** No account, no password — a data principal verifies by OTP, scoped to one organisation. */
@Controller("public/:orgSlug/verify")
export class PublicVerificationController {
  constructor(private readonly verification: ParticipantVerificationService) {}

  @Public()
  @Post("start")
  start(
    @Param("orgSlug") orgSlug: string,
    @Body() dto: StartVerificationDto,
  ): Promise<ParticipantChallengeView> {
    return this.verification.start(orgSlug, dto);
  }

  @Public()
  @Post(":verificationId/confirm")
  confirm(
    @Param("verificationId") verificationId: string,
    @Body() dto: ConfirmVerificationDto,
  ): Promise<ParticipantSessionView> {
    return this.verification.confirm(verificationId, dto);
  }
}
