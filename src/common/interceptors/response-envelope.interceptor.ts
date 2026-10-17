import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs";

/**
 * Wraps every successful controller response in the one envelope shape
 * every API consumer (the Angular frontend, any future integration) can
 * rely on regardless of which module answered: `{ success: true, data }`.
 * HttpExceptionFilter mirrors this with `{ success: false, error }` on the
 * failure path, so a caller only ever has to branch on `success`, never on
 * per-endpoint response shape.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: true; data: unknown }> {
    return next
      .handle()
      .pipe(map((data) => ({ success: true as const, data })));
  }
}
