import { ForbiddenException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Defense-in-depth CSRF mitigation: a mutating request must declare an Origin we recognise. */
export function createOriginCheckMiddleware(allowedOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.header("origin");
    if (origin && origin !== allowedOrigin) {
      throw new ForbiddenException("Request origin not allowed.");
    }
    next();
  };
}
