import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ChallengeView, SessionView } from "@sahmati/contracts";
import { AuthService } from "../services/auth.service";
import { SignupDto } from "../dto/signup.dto";
import { LoginDto } from "../dto/login.dto";
import { VerifyChallengeDto } from "../dto/verify-challenge.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";
import { AppConfigService } from "../../config/app-config.service";

const SESSION_COOKIE = "sahmati_session";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post("signup")
  signup(@Body() dto: SignupDto): Promise<ChallengeView> {
    return this.auth.signup(dto);
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto): Promise<ChallengeView> {
    return this.auth.login(dto);
  }

  @Public()
  @Post("challenges/:id/verify")
  async verify(
    @Param("id") id: string,
    @Body() dto: VerifyChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ session: SessionView }> {
    const { token, expiresAt, session } = await this.auth.verify(id, dto);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: this.config.isProduction,
      expires: expiresAt,
      path: "/",
    });
    return { session };
  }

  @HttpCode(204)
  @Post("logout")
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @Get("me")
  me(@CurrentSession() session: AuthenticatedSession): AuthenticatedSession {
    return session;
  }
}
