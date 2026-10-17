import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

/** Normalises every error response shape and never leaks a raw stack trace or driver error to the client. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? exception.getResponse()
      : { message: "Something went wrong. Please try again." };

    if (!isHttp) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response
      .status(status)
      .json(typeof body === "string" ? { message: body } : body);
  }
}
