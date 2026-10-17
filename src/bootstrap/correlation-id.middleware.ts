import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface CorrelatedRequest extends Request {
  correlationId: string;
}

/** Stamps every request with a correlation id, echoed back in error bodies and used in server logs. */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = randomUUID();
  (req as CorrelatedRequest).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}
