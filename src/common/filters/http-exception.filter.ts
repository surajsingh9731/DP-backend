import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface CorrelatedRequest extends Request {
  correlationId?: string;
}

/**
 * Normalizes every error response to the same small shape and never leaks
 * an internal stack trace or raw driver error to the client. Every response
 * carries the request's correlation id so a report can be matched back to a
 * server log line without exposing that log to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<CorrelatedRequest>();
    const correlationId = request.correlationId ?? "unknown";

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof body === "string"
        ? body
        : ((body as { message?: string | string[] } | null)?.message ??
          "Internal error.");

    if (status >= 500) {
      this.logger.error(`[${correlationId}] ${String(exception)}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      correlationId,
    });
  }
}
