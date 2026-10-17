import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { NoticeSnapshotView } from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentMembership } from "../../common/decorators/current-membership.decorator";
import type { CurrentMembership as Membership } from "../../common/guards/tenant-membership.guard";
import { NoticesService } from "../services/notices.service";
import { CreateNoticeDto } from "../dto/create-notice.dto";
import { NoticeDecisionDto } from "../dto/notice-decision.dto";

@Controller("tenants/:tenantId/notices")
@UseGuards(TenantMembershipGuard)
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  list(@Param("tenantId") tenantId: string): Promise<NoticeSnapshotView[]> {
    return this.notices.list(tenantId);
  }

  @Get(":id")
  get(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
  ): Promise<NoticeSnapshotView> {
    return this.notices.get(tenantId, id);
  }

  @Post()
  @Roles("owner", "staff")
  submit(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateNoticeDto,
    @CurrentMembership() membership: Membership,
  ): Promise<NoticeSnapshotView> {
    return this.notices.submit(tenantId, dto, membership);
  }

  @Post(":id/decisions")
  @Roles("owner")
  decide(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: NoticeDecisionDto,
    @CurrentMembership() membership: Membership,
  ): Promise<NoticeSnapshotView> {
    return this.notices.decide(tenantId, id, dto, membership);
  }

  @Get(":id/export.pdf")
  async exportPdf(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.notices.renderPdf(tenantId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sahmati-local-sample.pdf"',
    );
    res.send(pdf);
  }

  @Get(":id/qr.png")
  async exportQr(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.notices.renderQr(tenantId, id);
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  }
}
