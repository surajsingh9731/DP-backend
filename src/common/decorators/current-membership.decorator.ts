import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TenantMembershipRequest } from "../guards/tenant-membership.guard";

/** The caller's membership (role) in the :tenantId of this request, as attached by TenantMembershipGuard. */
export const CurrentMembership = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<TenantMembershipRequest>().membership,
);
