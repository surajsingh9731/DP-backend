import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedParticipant } from "../guards/participant-session.guard";

export const CurrentParticipant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedParticipant => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { participant?: AuthenticatedParticipant }>();
    if (!req.participant) {
      throw new Error(
        "CurrentParticipant used on a route with no ParticipantSessionGuard.",
      );
    }
    return req.participant;
  },
);
