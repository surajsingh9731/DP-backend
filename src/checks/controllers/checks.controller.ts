import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { CheckDetail, CheckEvaluation, MappingResult, TaskEvidenceReview } from '@sahmati/contracts';
import { TenantMembershipGuard } from '../../common/guards/tenant-membership.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator';
import type { CurrentMembership as Membership } from '../../common/guards/tenant-membership.guard';
import { ChecksService } from '../services/checks.service';
import { EvaluateChecksDto } from '../dto/evaluate-checks.dto';
import { ReviewEvidenceDto } from '../dto/review-evidence.dto';
import { ResolveLocationDto } from '../dto/resolve-location.dto';

@Controller('tenants/:tenantId/checks/tasks/:taskId')
@UseGuards(TenantMembershipGuard)
export class ChecksController {
  constructor(private readonly checks: ChecksService) {}

  @Get()
  get(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
  ): Promise<CheckDetail> {
    return this.checks.get(tenantId, taskId);
  }

  @Post('evaluations')
  @Roles('owner', 'staff')
  evaluate(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Body() dto: EvaluateChecksDto,
    @CurrentMembership() membership: Membership,
  ): Promise<CheckEvaluation> {
    return this.checks.evaluate(tenantId, taskId, dto, membership);
  }

  @Post('reviews')
  @Roles('owner')
  review(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ReviewEvidenceDto,
    @CurrentMembership() membership: Membership,
  ): Promise<TaskEvidenceReview> {
    return this.checks.review(tenantId, taskId, dto, membership);
  }

  @Post('mapping')
  @Roles('owner')
  map(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ResolveLocationDto,
    @CurrentMembership() membership: Membership,
  ): Promise<MappingResult> {
    return this.checks.mapLocation(tenantId, taskId, dto, membership);
  }
}
