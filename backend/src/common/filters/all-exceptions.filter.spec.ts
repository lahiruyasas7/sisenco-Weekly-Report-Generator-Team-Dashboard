import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: vi.fn(),
      json: vi.fn(),
    };
    mockResponse.status.mockReturnValue(mockResponse);
    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ArgumentsHost;
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it('maps Prisma P2002 to a generic 409 conflict response', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on field `email`',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      },
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'A record with this value already exists',
      error: 'Conflict',
    });
  });

  it('maps Prisma P2025 to a generic 404 response', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Record to delete does not exist.',
      {
        code: 'P2025',
        clientVersion: 'test',
        meta: { modelName: 'User' },
      },
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Record not found',
      error: 'Not Found',
    });
  });

  it('hides details for other Prisma errors', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Database connection details',
      { code: 'P1001', clientVersion: 'test' },
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });

  it('returns the status and response from an HttpException', () => {
    const exception = new BadRequestException({
      message: ['name must be a string'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['name must be a string'],
      error: 'Bad Request',
    });
  });

  it('hides non-Prisma internal error details and stack traces', () => {
    const exception = new Error('sensitive internal detail');
    exception.stack = 'internal stack trace';

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(mockResponse.json.mock.calls[0][0]).not.toHaveProperty('stack');
  });
});
