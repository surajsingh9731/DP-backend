import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedSession } from "../guards/session.guard";

export const CurrentSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedSession => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { authSession?: AuthenticatedSession }>();
    if (!req.authSession) {
      throw new Error(
        "CurrentSession used on a route with no resolved session — check the SessionGuard ran.",
      );
    }
    return req.authSession;
  },
);
