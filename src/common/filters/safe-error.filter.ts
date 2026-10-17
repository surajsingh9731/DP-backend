import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/models/auth-request.js';
@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('SafeError');
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const req = context.getRequest<AuthRequest>();
    const res = context.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status >= 500)
      this.logger.error({
        event: 'request_failed',
        requestId: req.requestId,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    const raw = error instanceof HttpException ? error.getResponse() : null;
    const message =
      raw && typeof raw === 'object' && 'message' in raw
        ? raw.message
        : 'The request could not be completed. Try again.';
    res.status(status).json({ statusCode: status, message, requestId: req.requestId });
  }
}
