import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { SectorPackView, SetupView } from "@sahmati/contracts";
import { TenantMembershipGuard } from "../../common/guards/tenant-membership.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { SetupService } from "../services/setup.service";
import { SaveSetupDto } from "../dto/save-setup.dto";
import { CompleteSetupDto } from "../dto/complete-setup.dto";

@Controller("tenants/:tenantId/setup")
@UseGuards(TenantMembershipGuard)
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  get(
    @Param("tenantId") tenantId: string,
  ): Promise<{ setup: SetupView | null; packs: SectorPackView[] }> {
    return this.setup.get(tenantId);
  }

  @Put()
  @Roles("owner", "staff")
  save(
    @Param("tenantId") tenantId: string,
    @Body() dto: SaveSetupDto,
  ): Promise<SetupView> {
    return this.setup.save(tenantId, dto);
  }

  @Post("complete")
  @Roles("owner")
  complete(
    @Param("tenantId") tenantId: string,
    @Body() dto: CompleteSetupDto,
  ): Promise<SetupView> {
    return this.setup.complete(tenantId, dto.version, dto.idempotencyKey);
  }
}
