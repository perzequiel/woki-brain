import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * Error response format
 */
export interface ErrorResponse {
  error: string;
  detail: string;
}

/**
 * Maps application errors to HTTP status codes and error responses
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      error: 'invalid_input',
      detail: firstIssue?.message || 'Invalid input parameters',
    });
    return;
  }

  // Application errors (thrown as Error with specific error codes)
  if (err instanceof Error) {
    const errorMessage = err.message;

    // Map error codes to HTTP status codes
    if (errorMessage === 'invalid_input') {
      res.status(400).json({
        error: 'invalid_input',
        detail: err.message || 'Invalid input parameters',
      } as ErrorResponse);
      return;
    }

    if (errorMessage === 'not_found') {
      res.status(404).json({
        error: 'not_found',
        detail: err.message || 'Resource not found',
      } as ErrorResponse);
      return;
    }

    if (errorMessage === 'no_capacity') {
      res.status(409).json({
        error: 'no_capacity',
        detail: err.message || 'No single or combo gap fits duration within window',
      } as ErrorResponse);
      return;
    }

    if (errorMessage === 'outside_service_window') {
      res.status(422).json({
        error: 'outside_service_window',
        detail: err.message || 'Window does not intersect service hours',
      } as ErrorResponse);
      return;
    }

    if (errorMessage === 'conflict') {
      res.status(409).json({
        error: 'conflict',
        detail: err.message || 'Booking conflict detected',
      } as ErrorResponse);
      return;
    }
  }

  // Unknown errors
  res.status(500).json({
    error: 'internal_error',
    detail: 'An unexpected error occurred',
  } as ErrorResponse);
}
