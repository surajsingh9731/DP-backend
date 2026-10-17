import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { EvidenceService } from './evidence.service.js';
import { EvidenceQueryDto, EvidencePathDto } from './dto/evidence.dto.js';
@Controller('tenants/:tenantId/evidence')
@UseGuards(SessionGuard, TenantGuard)
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}
  @Get() list(@Scope() scope: TenantScope, @Query() query: EvidenceQueryDto) {
    return this.service.list(scope, query);
  }
  @Get(':kind/:id/:version') detail(@Scope() scope: TenantScope, @Param() path: EvidencePathDto) {
    return this.service.detail(scope, path);
  }
}
