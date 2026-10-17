import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { RightsDetail, RightsRequest, RightsSummary } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator';
import type { CurrentMembership as Membership } from '../../common/guards/tenant-membership.guard';
import { RightsService } from '../services/rights.service';
import { RightsActionDto } from '../dto/rights-action.dto';

@Controller('tenants/:tenantId/rights')
@UseGuards(TenantMembershipGuard)
export class RightsAdminController {
  constructor(private readonly rights: RightsService) {}

  @Get()
  list(@Param('tenantId') tenantId: string): Promise<RightsSummary[]> {
    return this.rights.list(tenantId);
  }

  @Get(':id')
  get(@Param('tenantId') tenantId: string, @Param('id') id: string): Promise<RightsDetail> {
    return this.rights.get(tenantId, id);
  }

  @Post(':id/actions')
  @Roles('owner', 'staff')
  act(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: RightsActionDto,
    @CurrentMembership() membership: Membership,
  ): Promise<RightsRequest> {
    return this.rights.act(tenantId, id, dto, membership);
  }
}
