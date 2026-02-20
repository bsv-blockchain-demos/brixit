import type { Request, Response, NextFunction } from 'express';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

function statusColor(status: number): string {
  if (status >= 500) return RED;
  if (status >= 400) return YELLOW;
  if (status >= 300) return CYAN;
  return GREEN;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path } = req;
    const status = res.statusCode;
    const color = statusColor(status);

    console.log(
      `${color}${method.padEnd(7)}${RESET} ${path.padEnd(40)} ${color}${status}${RESET} ${DIM}${duration}ms${RESET}`,
    );
  });

  next();
}
