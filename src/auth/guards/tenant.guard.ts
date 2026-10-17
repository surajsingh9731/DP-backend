import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Database } from '../../database/database.service.js';
import { AuthRepository } from '../auth.repository.js';
import type { AuthRequest } from '../models/auth-request.js';
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly db: Database,
    private readonly repository: AuthRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const tenantId = req.params['tenantId'];
    if (typeof tenantId !== 'string' || !isUUID(tenantId) || !req.userId)
      throw new ForbiddenException('Workspace is unavailable.');
    const membership = await this.db.transaction(null, (client) =>
      this.repository.membership(client, tenantId, req.userId!),
    );
    if (!membership) throw new ForbiddenException('Workspace is unavailable.');
    req.scope = {
      tenantId,
      userId: req.userId,
      branchId: membership.branchId,
      role: membership.role,
    };
    return true;
  }
}
