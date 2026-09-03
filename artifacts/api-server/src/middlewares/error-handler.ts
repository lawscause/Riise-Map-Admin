import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../lib/tenant";
import { logger } from "../lib/logger";

/**
 * Terminal error handler. Express 5 forwards rejected promises from async
 * handlers here, so a guard that throws HttpError before a route's try/catch
 * ends the request with the intended status. Anything else is an unexpected
 * failure: log it and answer 500 without echoing internals.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
}
