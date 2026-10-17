import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { SessionView } from "@sahmati/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type {
  AuthenticatedRequest,
  AuthenticatedSession,
} from "../../common/guards/session.guard";
import { SESSION_COOKIE } from "../../common/guards/session.guard";
import { AuthService, type ChallengeResult } from "../services/auth.service";
import { CreateChallengeDto } from "../dto/create-challenge.dto";
import { VerifyChallengeDto } from "../dto/verify-challenge.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("challenges")
  createChallenge(@Body() dto: CreateChallengeDto): Promise<ChallengeResult> {
    return this.auth.createChallenge(dto.email, dto.language);
  }

  @Public()
  @Post("verify")
  async verify(
    @Body() dto: VerifyChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ signedIn: boolean }> {
    const result = await this.auth.verifyChallenge(dto.challengeId, dto.code);
    res.cookie(result.cookie.name, result.cookie.value, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: result.cookie.maxAgeMs,
      path: "/",
    });
    return { signedIn: result.signedIn };
  }

  @Get("me")
  me(@CurrentSession() session: AuthenticatedSession): SessionView {
    return {
      displayName: session.displayName,
      memberships: session.memberships,
    };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string> | undefined;
    await this.auth.logout(cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }
}
