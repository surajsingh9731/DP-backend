import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { FollowupsService } from './followups.service.js';
import { CreateFollowupsDto, FollowupActionDto } from './dto/followup.dto.js';
@Controller('tenants/:tenantId/followups')
@UseGuards(SessionGuard, TenantGuard)
export class FollowupsController {
  constructor(private readonly service: FollowupsService) {}
  @Get() list(@Scope() scope: TenantScope) {
    return this.service.list(scope);
  }
  @Get('assignees') assignees(@Scope() scope: TenantScope) {
    return this.service.assignees(scope);
  }
  @Post('from-receipt') create(@Scope() scope: TenantScope, @Body() dto: CreateFollowupsDto) {
    return this.service.create(scope, dto);
  }
  @Get(':id') detail(@Scope() scope: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(scope, id);
  }
  @Post(':id/actions') action(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FollowupActionDto,
  ) {
    return this.service.action(scope, id, dto);
  }
}
