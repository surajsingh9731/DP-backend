import { Controller, Get, Param } from "@nestjs/common";
import type { PublicNoticeView } from "@sahmati/contracts";
import { NoticesService } from "../services/notices.service";
import { Public } from "../../common/decorators/public.decorator";

/** No login, ever — see docs/architecture/R1-ui-ux-plan.md on the public-vs-authenticated shell split. */
@Controller("public/:orgSlug/notice")
export class PublicNoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Public()
  @Get()
  get(@Param("orgSlug") orgSlug: string): Promise<PublicNoticeView> {
    return this.notices.publicNoticeBySlug(orgSlug);
  }
}
