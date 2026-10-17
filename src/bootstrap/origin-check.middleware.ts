import { ForbiddenException, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('OriginCheck');

/**
 * Rejects any state-changing request whose Origin header isn't the exact
 * configured frontend origin. This is a local, single-origin tool: there is
 * no list of trusted origins to grow, no CORS wildcard, and no reason a
 * browser should ever send these cookies cross-site. GET requests are
 * allowed through without an Origin check (plain navigation/XHR same-origin
 * reads commonly omit the header); every mutating method requires it.
 */
export function createOriginCheckMiddleware(webOrigin: string) {
  return function originCheck(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (origin && origin !== webOrigin) {
      logger.warn(`Rejected request from unexpected Origin: ${origin}`);
      throw new ForbiddenException('Unexpected request origin.');
    }
    next();
  };
}
