import { Body, Controller, Get, Post } from "@nestjs/common";
import type { NoticeView } from "@sahmati/contracts";
import { NoticesService } from "../services/notices.service";
import { PublishNoticeDto } from "../dto/publish-notice.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("notices")
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get("current")
  current(): Promise<NoticeView | null> {
    return this.notices.current();
  }

  @Roles("owner")
  @Post("publish")
  publish(
    @Body() dto: PublishNoticeDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<NoticeView> {
    return this.notices.publish(dto, session);
  }
}
