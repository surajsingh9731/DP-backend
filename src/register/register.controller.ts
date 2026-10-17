import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { RegisterDto, UpdateRegisterDto, PreviewQuery } from './dto/register.dto.js';
import { RegisterService } from './register.service.js';
@Controller('tenants/:tenantId/register')
@UseGuards(SessionGuard, TenantGuard)
export class RegisterController {
  constructor(private readonly register: RegisterService) {}
  @Get() list(@Scope() s: TenantScope) {
    return this.register.list(s);
  }
  @Post() create(@Scope() s: TenantScope, @Body() dto: RegisterDto) {
    return this.register.save(s, dto);
  }
  @Patch(':id') update(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegisterDto,
  ) {
    return this.register.save(s, dto, id, dto.version);
  }
  @Get(':id/history') history(@Scope() s: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.register.history(s, id);
  }
  @Get(':id/notice-preview') preview(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PreviewQuery,
  ) {
    return this.register.preview(s, id, q.language);
  }
}
