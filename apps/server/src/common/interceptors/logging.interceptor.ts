import * as crypto from "node:crypto";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { type Observable, tap } from "rxjs";
import type { Logger } from "winston";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };
    if (sanitized.authorization) sanitized.authorization = "[REDACTED]";
    if (sanitized.cookie) sanitized.cookie = "[REDACTED]";
    if (sanitized["x-api-key"]) sanitized["x-api-key"] = "[REDACTED]";
    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, headers } = req;

    // Normally set by requestIdMiddleware; the fallback covers contexts
    // (tests, non-HTTP adapters) where the middleware did not run.
    const requestId = req.requestId ?? crypto.randomUUID();
    req.requestId = requestId;

    const startTime = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const durationMs = Math.round(performance.now() - startTime);
          const statusCode = res.statusCode;

          const logData = {
            requestId,
            method,
            url: originalUrl,
            statusCode,
            durationMs,
            headers: this.sanitizeHeaders(headers),
          };

          if (statusCode >= 400 && statusCode < 500) {
            this.logger.warn(`[${method}] ${originalUrl} ${statusCode} - ${durationMs}ms`, logData);
          } else {
            this.logger.info(`[${method}] ${originalUrl} ${statusCode} - ${durationMs}ms`, logData);
          }
        },
        error: (err: Error) => {
          const durationMs = Math.round(performance.now() - startTime);
          this.logger.error(`[${method}] ${originalUrl} ERROR - ${durationMs}ms`, {
            requestId,
            method,
            url: originalUrl,
            durationMs,
            error: err.message,
          });
        },
      }),
    );
  }
}
