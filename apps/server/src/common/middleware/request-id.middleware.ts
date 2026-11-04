import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Accept a caller-supplied id only if it is short and log-safe; anything
// else (newlines, huge values) could forge or flood log lines.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Runs before guards, so every response — including 401s thrown by
 * JwtAuthGuard — carries the id in the `x-request-id` header and in the
 * error body. Registered in main.ts.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
