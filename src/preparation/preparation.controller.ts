import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { PreparationService } from './preparation.service.js';
import { SaveTemplateDto, SaveContactDto } from './dto/save-preparation.dto.js';
import { PreparationActionDto } from './dto/preparation-action.dto.js';
@Controller('tenants/:tenantId/preparation')
@UseGuards(SessionGuard, TenantGuard)
export class PreparationController {
  constructor(private readonly service: PreparationService) {}
  @Get() list(@Scope() scope: TenantScope) {
    return this.service.list(scope);
  }
  @Get(':id') detail(@Scope() scope: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(scope, id);
  }
  @Post('templates') createTemplate(@Scope() scope: TenantScope, @Body() dto: SaveTemplateDto) {
    return this.service.save(scope, 'template', dto);
  }
  @Put('templates/:id') saveTemplate(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveTemplateDto,
  ) {
    return this.service.save(scope, 'template', dto, id);
  }
  @Post('contacts') createContact(@Scope() scope: TenantScope, @Body() dto: SaveContactDto) {
    return this.service.save(scope, 'contact', dto);
  }
  @Put('contacts/:id') saveContact(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveContactDto,
  ) {
    return this.service.save(scope, 'contact', dto, id);
  }
  @Post(':id/actions') action(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreparationActionDto,
  ) {
    return this.service.action(scope, id, dto);
  }
}
