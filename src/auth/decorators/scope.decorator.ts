import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { AuthRequest } from '../models/auth-request.js';
export const Scope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantScope =>
    context.switchToHttp().getRequest<AuthRequest>().scope!,
);
