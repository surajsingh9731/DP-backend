import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Database } from '../../database/database.service.js';
import { SESSION_COOKIE } from '../../constants/auth.constants.js';
import { SESSION_TOKEN_PATTERN } from '../../constants/security.constants.js';
import { AuthRepository } from '../auth.repository.js';
import type { AuthRequest } from '../models/auth-request.js';
import { hashToken } from '../security-hash.js';
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly db: Database,
    private readonly repository: AuthRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !SESSION_TOKEN_PATTERN.test(token))
      throw new UnauthorizedException('Sign in again.');
    const hashed = hashToken(token);
    const session = await this.db.transaction(null, (client) =>
      this.repository.activeSession(client, hashed),
    );
    if (!session) throw new UnauthorizedException('Sign in again.');
    req.userId = session.userId;
    req.tokenHash = hashed;
    return true;
  }
}
