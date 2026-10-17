import type { TenantScope } from '@sahmati/contracts';
import type { Request } from 'express';
export interface AuthRequest extends Request {
  userId?: string;
  tokenHash?: string;
  scope?: TenantScope;
  requestId?: string;
}
