import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Generates a request ID if not present in headers
 * Adds requestId to request object for use in logging
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = requestId;
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
