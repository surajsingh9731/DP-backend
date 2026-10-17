import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { MembershipRole } from "../../auth/entities/membership.entity";
import type { AuthenticatedSession } from "./session.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Role authorization within an already-isolated tenant — RLS proves which
 * tenant's rows are reachable at all; this guard decides which role may
 * reach a given handler. Not RLS, and never a substitute for it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { authSession?: AuthenticatedSession }>();
    const role = req.authSession?.role;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(", ")}.`,
      );
    }
    return true;
  }
}
