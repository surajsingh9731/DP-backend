import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const HEADER = "x-correlation-id";

/** Every log line and error response can be tied back to one request, across the API and worker processes. */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(HEADER);
  const id =
    incoming && /^[\w-]{1,100}$/u.test(incoming) ? incoming : randomUUID();
  res.setHeader(HEADER, id);
  (req as Request & { correlationId: string }).correlationId = id;
  next();
}
