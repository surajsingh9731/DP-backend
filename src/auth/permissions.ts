import type { TenantScope } from '@sahmati/contracts';
import { WORKSPACE_ROLES } from '../constants/security.constants.js';
export function mayClose(scope: TenantScope, assigneeId: string): boolean {
  return (
    scope.role === WORKSPACE_ROLES.owner ||
    (scope.role === WORKSPACE_ROLES.staff && scope.userId === assigneeId)
  );
}
