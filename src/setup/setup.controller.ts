import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { SaveSetupDto, CompleteSetupDto } from './dto/setup.dto.js';
import { SetupService } from './setup.service.js';
@Controller('tenants/:tenantId/setup')
@UseGuards(SessionGuard, TenantGuard)
export class SetupController {
  constructor(private readonly setup: SetupService) {}
  @Get() get(@Scope() s: TenantScope) {
    return this.setup.get(s);
  }
  @Put() save(@Scope() s: TenantScope, @Body() dto: SaveSetupDto) {
    return this.setup.save(s, dto);
  }
  @Post('complete') complete(@Scope() s: TenantScope, @Body() dto: CompleteSetupDto) {
    return this.setup.complete(s, dto);
  }
}
