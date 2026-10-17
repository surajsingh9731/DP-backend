import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { AuthRequest } from '../auth/models/auth-request.js';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import { CONSENT_COOKIE } from '../constants/consent.constants.js';
import { ParticipantRightsService } from './participant-rights.service.js';
import { SubmitRightsDto } from './dto/rights.dto.js';
@Controller('tenants/:tenantId/consent-sandbox/sessions/:sessionId/requests')
@UseGuards(SessionGuard, TenantGuard)
export class ParticipantRightsController {
  constructor(private readonly service: ParticipantRightsService) {}
  @Get() list(
    @Scope() scope: TenantScope,
    @Param('sessionId', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.list(scope, id, req.cookies?.[CONSENT_COOKIE]);
  }
  @Get(':id') detail(
    @Scope() scope: TenantScope,
    @Param('sessionId', ParseUUIDPipe) session: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.detail(scope, session, id, req.cookies?.[CONSENT_COOKIE]);
  }
  @Post() submit(
    @Scope() scope: TenantScope,
    @Param('sessionId', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() dto: SubmitRightsDto,
  ) {
    return this.service.submit(scope, id, req.cookies?.[CONSENT_COOKIE], dto);
  }
}
