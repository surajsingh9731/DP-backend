import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TenantRole } from "@sahmati/contracts";
import type { AuthenticatedRequest } from "./session.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

export interface CurrentMembership {
  tenantId: string;
  userId: string;
  role: TenantRole;
}

export interface TenantMembershipRequest extends AuthenticatedRequest {
  membership: CurrentMembership;
}

/**
 * Applied per-controller on every `/tenants/:tenantId/...` route. Confirms
 * the signed-in caller (attached by SessionGuard) actually has a membership
 * row for the :tenantId in the URL, and — if the handler carries @Roles(...)
 * — that their role in THIS tenant is one of them. A role claimed anywhere
 * else (another tenant, the request body) is never consulted.
 */
@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<TenantMembershipRequest>();
    const tenantId = request.params.tenantId as string | undefined;
    const membership = request.authSession?.memberships.find(
      (m) => m.tenantId === tenantId,
    );
    if (!tenantId || !membership) {
      throw new ForbiddenException("No membership in this tenant.");
    }
    const requiredRoles = this.reflector.getAllAndOverride<
      TenantRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of: ${requiredRoles.join(", ")}.`,
      );
    }
    request.membership = {
      tenantId,
      userId: request.authSession!.userId,
      role: membership.role,
    };
    return true;
  }
}
