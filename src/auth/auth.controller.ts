import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_CLEAR_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from '../constants/auth.constants.js';
import { AuthService } from './auth.service.js';
import { EmailDto } from './dto/email.dto.js';
import { VerifyDto } from './dto/verify.dto.js';
import { SessionGuard } from './guards/session.guard.js';
import type { AuthRequest } from './models/auth-request.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('challenges') @HttpCode(202) request(@Body() dto: EmailDto) {
    return this.auth.request(dto.email, dto.language);
  }
  @Post('verify') @HttpCode(200) async verify(
    @Body() dto: VerifyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.auth.verify(dto.challengeId, dto.code);
    response.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return { signedIn: true };
  }
  @Get('me') @UseGuards(SessionGuard) me(@Req() req: AuthRequest) {
    return this.auth.me(req.userId!);
  }
  @Post('logout') @HttpCode(200) @UseGuards(SessionGuard) async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(req.tokenHash!);
    response.clearCookie(SESSION_COOKIE, SESSION_COOKIE_CLEAR_OPTIONS);
    return { signedOut: true };
  }
}
