import { NoticeExportService } from './notice-export.service.js';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { NoticesService } from './notices.service.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { NoticeDecisionDto } from './dto/notice-decision.dto.js';
@Controller('tenants/:tenantId/notices')
@UseGuards(SessionGuard, TenantGuard)
export class NoticesController {
  constructor(
    private readonly notices: NoticesService,
    private readonly exports: NoticeExportService,
  ) {}
  @Get() list(@Scope() scope: TenantScope) {
    return this.notices.list(scope);
  }
  @Get(':id') detail(@Scope() scope: TenantScope, @Param('id', ParseUUIDPipe) id: string) {
    return this.notices.detail(scope, id);
  }

  @Get(':id/export.pdf') async exportPdf(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const snapshot = await this.notices.detail(scope, id);
    return new StreamableFile(await this.exports.pdf(scope, snapshot), {
      type: 'application/pdf',
      disposition: `attachment; filename="sahmati-sample-${id}.pdf"`,
    });
  }
  @Get(':id/qr.png') async exportQr(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const snapshot = await this.notices.detail(scope, id);
    return new StreamableFile(await this.exports.qr(scope, snapshot), {
      type: 'image/png',
      disposition: `attachment; filename="sahmati-local-sample-${id}.png"`,
    });
  }
  @Post() create(@Scope() scope: TenantScope, @Body() dto: CreateNoticeDto) {
    return this.notices.create(scope, dto);
  }
  @Post(':id/decisions') decide(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoticeDecisionDto,
  ) {
    return this.notices.decide(scope, id, dto);
  }
}
