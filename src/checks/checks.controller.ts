import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { ChecksService } from './checks.service.js';
import { LocationReviewService } from './location-review.service.js';
import { EvaluateChecksDto, ReviewEvidenceDto, ResolveLocationDto } from './dto/checks.dto.js';
@Controller('tenants/:tenantId/checks/tasks')
@UseGuards(SessionGuard, TenantGuard)
export class ChecksController {
  constructor(
    private readonly service: ChecksService,
    private readonly mapping: LocationReviewService,
  ) {}
  @Get(':id') detail(@Scope() scope: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(scope, id);
  }
  @Post(':id/reviews') review(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEvidenceDto,
  ) {
    return this.service.review(scope, id, dto);
  }
  @Post(':id/evaluations') evaluate(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateChecksDto,
  ) {
    return this.service.evaluate(scope, id, dto);
  }
  @Post(':id/mapping') resolve(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveLocationDto,
  ) {
    return this.mapping.resolve(scope, id, dto);
  }
}
