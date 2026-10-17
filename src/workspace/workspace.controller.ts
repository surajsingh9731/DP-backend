import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { CloseTaskDto } from './close-task.dto.js';
import { CreateTaskDto } from './create-task.dto.js';
import { WorkspaceService } from './workspace.service.js';
@Controller('tenants/:tenantId')
@UseGuards(SessionGuard, TenantGuard)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('summary') summary(@Scope() scope: TenantScope) {
    return this.workspace.summary(scope);
  }
  @Post('tasks') create(@Scope() scope: TenantScope, @Body() dto: CreateTaskDto) {
    return this.workspace.create(scope, dto);
  }
  @Post('tasks/:id/close') close(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTaskDto,
  ) {
    return this.workspace.close(scope, id, dto.version);
  }
}
