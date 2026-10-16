import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { Prisma } from '../../generated/prisma/client.js';

type ErrorResponse = {
  statusCode: number;
  message: string | string[];
  error: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status: (code: number) => { json: (body: ErrorResponse) => void };
    }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = STATUS_CODES[statusCode] ?? 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      error = STATUS_CODES[statusCode] ?? error;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse) {
        const body = exceptionResponse as Record<string, unknown>;
        if (typeof body.message === 'string') message = body.message;
        if (
          Array.isArray(body.message) &&
          body.message.every((item) => typeof item === 'string')
        ) {
          message = body.message;
        }
        if (typeof body.error === 'string') error = body.error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
        error = STATUS_CODES[statusCode] ?? 'Conflict';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        error = STATUS_CODES[statusCode] ?? 'Not Found';
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({ statusCode, message, error });
  }
}
