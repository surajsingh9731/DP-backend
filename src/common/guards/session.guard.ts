import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Membership } from '@sahmati/contracts';
import { AppConfig } from '../../config/app-config.service';
import { SessionEntity } from '../../auth/entities/session.entity';
import { UserEntity } from '../../auth/entities/user.entity';
import { MembershipEntity } from '../../auth/entities/membership.entity';
import { TenantEntity } from '../../auth/entities/tenant.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const SESSION_COOKIE = 'sahmati_session';

export interface AuthenticatedSession {
  userId: string;
  displayName: string;
  memberships: Membership[];
}

export interface AuthenticatedRequest extends Request {
  authSession?: AuthenticatedSession | null;
}

/**
 * Global guard: resolves the `sahmati_session` cookie into the signed-in
 * user and their tenant memberships, and attaches it to the request as
 * `authSession`. A route marked @Public() is allowed through with no
 * session at all (authSession stays undefined); every other route requires
 * a valid, unrevoked, unexpired session.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(MembershipEntity) private readonly memberships: Repository<MembershipEntity>,
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.resolveSession(request);
    request.authSession = session;
    if (session) return true;
    if (isPublic) return true;
    throw new UnauthorizedException('Sign in required.');
  }

  private async resolveSession(request: AuthenticatedRequest): Promise<AuthenticatedSession | null> {
    const cookies = request.cookies as Record<string, string> | undefined;
    const sessionId = cookies?.[SESSION_COOKIE];
    if (!sessionId) return null;

    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    if (!this.matchesToken(session, cookies![SESSION_COOKIE])) return null;

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user) return null;

    const memberships = await this.memberships.find({ where: { userId: user.id } });
    const tenantIds = memberships.map((m) => m.tenantId);
    const tenants = tenantIds.length ? await this.tenants.findBy({ id: In(tenantIds) }) : [];
    const tenantsById = new Map(tenants.map((t) => [t.id, t]));
    const tenantMemberships: Membership[] = memberships.map((m) => {
      const tenant = tenantsById.get(m.tenantId);
      return {
        tenantId: m.tenantId,
        role: m.role,
        name: tenant?.name ?? '',
        branch: tenant?.branch ?? '',
      };
    });

    return { userId: user.id, displayName: user.displayName, memberships: tenantMemberships };
  }

  private matchesToken(session: SessionEntity, cookieValue: string): boolean {
    const expected = createHash('sha256')
      .update(`${session.id}:${this.config.authPepper}`)
      .digest('hex');
    return session.tokenHash === expected && cookieValue === session.id;
  }
}
