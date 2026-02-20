import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ERROR]', err.message, err.stack);

  const status = (err as any).status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// Helper to create errors with status codes
export function createHttpError(status: number, message: string): Error {
  const err = new Error(message);
  (err as any).status = status;
  return err;
}
