import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { RetentionRecordsService } from './retention-records.service.js';
import { RetentionPoliciesService } from './retention-policies.service.js';
import { RetentionHoldsService } from './retention-holds.service.js';
import { RetentionPreviewsService } from './retention-previews.service.js';
import {
  CreateRetentionPolicyDto,
  EditRetentionPolicyDto,
  RetentionPolicyActionDto,
  CreateRetentionHoldDto,
  ReleaseRetentionHoldDto,
  CreateRetentionPreviewDto,
  RetentionListDto,
  RetentionPreviewPageDto,
} from './dto/retention.dto.js';
@Controller('tenants/:tenantId/retention')
@UseGuards(SessionGuard, TenantGuard)
export class RetentionController {
  constructor(
    private readonly records: RetentionRecordsService,
    private readonly policies: RetentionPoliciesService,
    private readonly holds: RetentionHoldsService,
    private readonly previews: RetentionPreviewsService,
  ) {}
  @Get('policies') listPolicies(@Scope() s: TenantScope, @Query() q: RetentionListDto) {
    return this.records.list(s, 'policy', q);
  }
  @Get('policies/:id') policy(@Scope() s: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.records.detail(s, 'policy', id);
  }
  @Post('policies') createPolicy(@Scope() s: TenantScope, @Body() d: CreateRetentionPolicyDto) {
    return this.policies.create(s, d);
  }
  @Put('policies/:id') editPolicy(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EditRetentionPolicyDto,
  ) {
    return this.policies.edit(s, id, d);
  }
  @Post('policies/:id/actions') policyAction(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RetentionPolicyActionDto,
  ) {
    return this.policies.action(s, id, d);
  }
  @Get('holds') listHolds(@Scope() s: TenantScope, @Query() q: RetentionListDto) {
    return this.records.list(s, 'hold', q);
  }
  @Get('holds/:id') hold(@Scope() s: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.records.detail(s, 'hold', id);
  }
  @Post('holds') createHold(@Scope() s: TenantScope, @Body() d: CreateRetentionHoldDto) {
    return this.holds.create(s, d);
  }
  @Post('holds/:id/release') release(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReleaseRetentionHoldDto,
  ) {
    return this.holds.release(s, id, d);
  }
  @Get('activities/:id/context') context(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.previews.context(s, id);
  }
  @Get('previews') listPreviews(@Scope() s: TenantScope, @Query() q: RetentionListDto) {
    return this.previews.list(s, q);
  }
  @Get('previews/:id') preview(
    @Scope() s: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: RetentionPreviewPageDto,
  ) {
    return this.previews.get(s, id, q);
  }
  @Post('previews') createPreview(@Scope() s: TenantScope, @Body() d: CreateRetentionPreviewDto) {
    return this.previews.create(s, d);
  }
}
