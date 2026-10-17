import { SetMetadata } from "@nestjs/common";
import type { TenantRole } from "@sahmati/contracts";

export const ROLES_KEY = "roles";

/**
 * Restricts a tenant-scoped route to the given roles. Checked by
 * TenantMembershipGuard against the caller's membership row for the
 * :tenantId in the route — never against a role claimed by the client.
 */
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
