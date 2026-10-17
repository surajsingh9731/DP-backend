import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { Repository } from "typeorm";
import type { Request } from "express";
import { SessionEntity } from "../../auth/entities/session.entity";
import type { MembershipRole } from "../../auth/entities/membership.entity";
import { AppConfigService } from "../../config/app-config.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export interface AuthenticatedSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  membershipId: string;
  role: MembershipRole;
}

const SESSION_COOKIE = "sahmati_session";

/**
 * Resolves the session cookie into `req.tenantId` + `req.authSession`
 * before TenantContextInterceptor runs (guards execute before
 * interceptors in Nest's pipeline) — this is the only place a tenant id
 * is derived from anything other than a signed-off server-side lookup.
 * Reads the sessions table via the default pool, which is safe only
 * because that table's RLS policy is intentionally open (see
 * database/rls/enable-rls.ts `operationalAccessSql`) — nothing else here
 * bypasses tenant isolation.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context
      .switchToHttp()
      .getRequest<
        Request & { tenantId?: string; authSession?: AuthenticatedSession }
      >();

    if (isPublic) {
      return true;
    }

    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException("No session.");

    const tokenHash = createHash("sha256")
      .update(`${token}${this.config.authPepper}`)
      .digest("hex");
    const session = await this.sessions.findOne({ where: { tokenHash } });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session expired or invalid.");
    }

    req.tenantId = session.tenantId;
    req.authSession = {
      sessionId: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      membershipId: session.membershipId,
      role: session.role,
    };
    return true;
  }
}
