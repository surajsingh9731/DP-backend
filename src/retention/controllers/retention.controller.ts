import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type {
  RetentionActionView,
  RetentionHoldView,
  RetentionPreviewItemView,
} from "@sahmati/contracts";
import { RetentionService } from "../services/retention.service";
import { PlaceHoldDto } from "../dto/place-hold.dto";
import { ReleaseHoldDto } from "../dto/release-hold.dto";
import { ExecuteErasureDto } from "../dto/execute-erasure.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("retention")
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get("preview")
  preview(): Promise<RetentionPreviewItemView[]> {
    return this.retention.preview();
  }

  @Get("holds")
  listHolds(): Promise<RetentionHoldView[]> {
    return this.retention.listHolds();
  }

  @Roles("owner", "staff")
  @Post("holds")
  placeHold(
    @Body() dto: PlaceHoldDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RetentionHoldView> {
    return this.retention.placeHold(dto, session);
  }

  @Roles("owner", "staff")
  @Post("holds/:id/release")
  releaseHold(
    @Param("id") id: string,
    @Body() dto: ReleaseHoldDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RetentionHoldView> {
    return this.retention.releaseHold(id, dto, session);
  }

  @Roles("owner", "staff")
  @Post("erasures")
  executeErasure(
    @Body() dto: ExecuteErasureDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RetentionActionView> {
    return this.retention.executeErasure(dto, session);
  }
}
