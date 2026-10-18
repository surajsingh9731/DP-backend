import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import type {
  CommissionRecordView,
  PartnerOrganisationView,
  PartnerProfileView,
} from "@sahmati/contracts";
import { PartnerService } from "../services/partner.service";
import { UpsertPartnerProfileDto } from "../dto/upsert-partner-profile.dto";
import { RecordCommissionDto } from "../dto/record-commission.dto";
import { UpdateCommissionStatusDto } from "../dto/update-commission-status.dto";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("partner")
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get("organisations")
  myOrganisations(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<PartnerOrganisationView[]> {
    return this.partner.myOrganisations(session);
  }

  @Get("profile")
  getProfile(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<PartnerProfileView | null> {
    return this.partner.getProfile(session);
  }

  @Put("profile")
  upsertProfile(
    @Body() dto: UpsertPartnerProfileDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<PartnerProfileView> {
    return this.partner.upsertProfile(dto, session);
  }

  @Get("commissions")
  listCommissions(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<CommissionRecordView[]> {
    return this.partner.listCommissions(session);
  }

  @Post("commissions")
  recordCommission(
    @Body() dto: RecordCommissionDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<CommissionRecordView> {
    return this.partner.recordCommission(dto, session);
  }

  @Put("commissions/:id/status")
  updateCommissionStatus(
    @Param("id") id: string,
    @Body() dto: UpdateCommissionStatusDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<CommissionRecordView> {
    return this.partner.updateCommissionStatus(id, dto, session);
  }
}
