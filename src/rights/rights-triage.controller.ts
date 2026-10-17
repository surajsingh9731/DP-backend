import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { RightsTriageService } from './rights-triage.service.js';
import { RightsActionDto } from './dto/rights.dto.js';
@Controller('tenants/:tenantId/rights')
@UseGuards(SessionGuard, TenantGuard)
export class RightsTriageController {
  constructor(private readonly service: RightsTriageService) {}
  @Get() list(@Scope() scope: TenantScope) {
    return this.service.list(scope);
  }
  @Get(':id') detail(@Scope() scope: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(scope, id);
  }
  @Post(':id/actions') action(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RightsActionDto,
  ) {
    return this.service.action(scope, id, dto);
  }
}
