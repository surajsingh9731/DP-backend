import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { FollowupAssignee, FollowupDetail, FollowupTask } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator';
import type { CurrentMembership as Membership } from '../../common/guards/tenant-membership.guard';
import { FollowupsService } from '../services/followups.service';
import { CreateFromReceiptDto } from '../dto/create-from-receipt.dto';
import { FollowupActionDto } from '../dto/followup-action.dto';

@Controller('tenants/:tenantId/followups')
@UseGuards(TenantMembershipGuard)
export class FollowupsController {
  constructor(private readonly followups: FollowupsService) {}

  @Get()
  list(@Param('tenantId') tenantId: string): Promise<FollowupTask[]> {
    return this.followups.list(tenantId);
  }

  @Get('assignees')
  assignees(@Param('tenantId') tenantId: string): Promise<FollowupAssignee[]> {
    return this.followups.assignees(tenantId);
  }

  @Get(':id')
  get(@Param('tenantId') tenantId: string, @Param('id') id: string): Promise<FollowupDetail> {
    return this.followups.get(tenantId, id);
  }

  @Post('from-receipt')
  @Roles('owner', 'staff')
  createFromReceipt(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateFromReceiptDto,
    @CurrentMembership() membership: Membership,
  ): Promise<FollowupTask[]> {
    return this.followups.createFromReceipt(tenantId, dto, membership);
  }

  @Post(':id/actions')
  @Roles('owner', 'staff')
  act(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: FollowupActionDto,
    @CurrentMembership() membership: Membership,
  ): Promise<FollowupTask> {
    return this.followups.act(tenantId, id, dto, membership);
  }
}
