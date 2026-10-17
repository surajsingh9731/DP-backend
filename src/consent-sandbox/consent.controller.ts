import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { TenantScope } from '@sahmati/contracts';
import type { AuthRequest } from '../auth/models/auth-request.js';
import { Scope } from '../auth/decorators/scope.decorator.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { TenantGuard } from '../auth/guards/tenant.guard.js';
import {
  CONSENT_COOKIE,
  CONSENT_LIMITS,
  consentCookiePath,
} from '../constants/consent.constants.js';
import { ConsentOffersService } from './consent-offers.service.js';
import { ConsentParticipantsService } from './consent-participants.service.js';
import { ConsentChoicesService } from './consent-choices.service.js';
import {
  CreateConsentOfferDto,
  StartConsentParticipantDto,
  SubmitConsentChoicesDto,
  WithdrawConsentChoicesDto,
} from './dto/consent.dto.js';
@Controller('tenants/:tenantId/consent-sandbox')
@UseGuards(SessionGuard, TenantGuard)
export class ConsentController {
  constructor(
    private readonly offers: ConsentOffersService,
    private readonly participants: ConsentParticipantsService,
    private readonly choices: ConsentChoicesService,
  ) {}
  @Get('offers') list(@Scope() scope: TenantScope) {
    return this.offers.list(scope);
  }
  @Post('offers') create(@Scope() scope: TenantScope, @Body() dto: CreateConsentOfferDto) {
    return this.offers.create(scope, dto);
  }
  @Get('receipts') ledger(@Scope() scope: TenantScope) {
    return this.participants.ledger(scope);
  }
  @Post('sessions') async start(
    @Scope() scope: TenantScope,
    @Body() dto: StartConsentParticipantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.participants.start(scope, dto.offerId);
    res.cookie(CONSENT_COOKIE, result.token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: consentCookiePath(scope.tenantId, result.participant.id),
      maxAge: CONSENT_LIMITS.sessionSeconds * 1000,
    });
    return result.participant;
  }
  @Get('sessions/:id') get(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.participants.get(scope, id, req.cookies?.[CONSENT_COOKIE]);
  }
  @Post('sessions/:id/choices') record(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() dto: SubmitConsentChoicesDto,
  ) {
    return this.choices.record(scope, id, req.cookies?.[CONSENT_COOKIE], dto);
  }
  @Post('sessions/:id/withdraw') withdraw(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() dto: WithdrawConsentChoicesDto,
  ) {
    return this.choices.record(scope, id, req.cookies?.[CONSENT_COOKIE], dto, true);
  }
  @Post('sessions/:id/end') async end(
    @Scope() scope: TenantScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.participants.end(scope, id, req.cookies?.[CONSENT_COOKIE]);
    res.clearCookie(CONSENT_COOKIE, {
      path: consentCookiePath(scope.tenantId, id),
      sameSite: 'strict',
    });
    return result;
  }
}
