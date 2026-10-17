import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

/**
 * Normalises every error response into the same `{ success: false, error }`
 * envelope ResponseEnvelopeInterceptor uses for success — never leaks a raw
 * stack trace or driver error to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawBody = isHttp
      ? exception.getResponse()
      : { message: "Something went wrong. Please try again." };
    const normalised =
      typeof rawBody === "string" ? { message: rawBody } : rawBody;

    if (!isHttp) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json({
      success: false,
      error: { statusCode: status, ...normalised },
    });
  }
}
