import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { ZodError } from 'zod';
import config from '../../config';
import { IGenericErrorMessage } from '../../interfaces/error';
import handleZodError from '../../errors/handleZodError';
import ApiError from '../../errors/ApiErrors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const globalErrorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong!';
  let errorMessages: IGenericErrorMessage[] = [];

  // ── Zod Validation ──────────────────────────────────────────────────────────
  if (error instanceof ZodError) {
    const simplified = handleZodError(error);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  }

  // ── Custom Application Error ────────────────────────────────────────────────
  else if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errorMessages = [{ path: '', message: error.message }];
  }

  // ── Prisma: Record Not Found ─────────────────────────────────────────────────
  else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    statusCode = httpStatus.NOT_FOUND;
    message = 'Record not found';
    errorMessages = [{ path: '', message: 'The requested record was not found' }];
  }

  // ── Prisma: Unique Constraint ────────────────────────────────────────────────
  else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const meta = error.meta as { target?: string | string[] } | undefined;
    let targetField = 'field';
    if (typeof meta?.target === 'string') {
      targetField = meta.target.replace(/^.*_/, '').replace('_key', '');
    } else if (Array.isArray(meta?.target)) {
      targetField = meta.target[0];
    }
    statusCode = httpStatus.CONFLICT;
    message = `${targetField} already exists`;
    errorMessages = [{ path: targetField, message: `A record with this ${targetField} already exists` }];
  }

  // ── Prisma: Validation ───────────────────────────────────────────────────────
  else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid input data';
    errorMessages = [{ path: '', message: 'Invalid input. Please check your request payload.' }];
  }

  // ── Prisma: Other Known Errors ───────────────────────────────────────────────
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Database request error';
    errorMessages = [{ path: '', message: error.message }];
  }

  // ── Prisma: Connection / Internal ────────────────────────────────────────────
  else if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'A database error occurred';
    errorMessages = [{ path: '', message: 'Database is unavailable or encountered an error' }];
  }

  // ── JWT Errors ───────────────────────────────────────────────────────────────
  else if (
    error instanceof Error &&
    ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
  ) {
    statusCode = httpStatus.UNAUTHORIZED;
    message = error.message;
    errorMessages = [{ path: '', message: error.message }];
  }

  // ── Generic JS Errors ────────────────────────────────────────────────────────
  else if (error instanceof Error) {
    message = error.message;
    errorMessages = [{ path: '', message: error.message }];
  }

  // ── Unknown ──────────────────────────────────────────────────────────────────
  else {
    message = 'An unexpected error occurred';
    errorMessages = [{ path: '', message }];
  }

  // Log server-side (never send raw errors to client)
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    ...(config.env !== 'production' && error instanceof Error
      ? { stack: error.stack }
      : {}),
  });
};

export default globalErrorHandler;
