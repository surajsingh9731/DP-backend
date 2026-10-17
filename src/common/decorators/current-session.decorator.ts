import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../guards/session.guard";

/** The signed-in user for this request, as attached by SessionGuard. Null on a @Public() route. */
export const CurrentSession = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().authSession ??
    null,
);
