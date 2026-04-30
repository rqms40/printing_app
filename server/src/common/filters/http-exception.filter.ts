import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const responseBody: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url,
    };

    if (typeof raw === 'string') {
      responseBody.message = raw;
    } else if (raw && typeof raw === 'object') {
      // Forward structured exception payloads (message + optional code etc.)
      const r = raw as Record<string, unknown>;
      responseBody.message = r.message ?? 'Error';
      if (r.code !== undefined) responseBody.code = r.code;
      if (r.error !== undefined) responseBody.error = r.error;
    } else {
      responseBody.message = 'Error';
    }

    // Log everything at >=400; include stack for non-HttpException 500s so we
    // can actually diagnose unexpected crashes (previously they were silent).
    if (status >= 500 || !(exception instanceof HttpException)) {
      const err = exception as Error;
      this.logger.error(
        `${request?.method} ${request?.url} → ${status} ${err?.message ?? exception}`,
        err?.stack,
      );
    } else {
      this.logger.warn(
        `${request?.method} ${request?.url} → ${status} ${JSON.stringify(responseBody.message)}`,
      );
    }

    response.status(status).json(responseBody);
  }
}
