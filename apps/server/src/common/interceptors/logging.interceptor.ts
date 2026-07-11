import { Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    if (!request) {
      return next.handle();
    }

    const requestId = randomUUID();
    const start = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const durationMs = Date.now() - start;
          const statusCode = response.statusCode;

          const logData = {
            requestId,
            method,
            url,
            statusCode,
            durationMs,
          };

          if (statusCode >= 400) {
            this.logger.warn("Outgoing response", logData);
          } else {
            this.logger.info("Outgoing response", logData);
          }
        },
        error: () => {
          // Error logging is handled exclusively by GlobalExceptionFilter.
          // This interceptor only logs the request metadata at info/warn level
          // to avoid duplicate error entries.
          const durationMs = Date.now() - start;
          this.logger.warn("Request ended with error", {
            requestId,
            method,
            url,
            durationMs,
          });
        },
      }),
    );
  }
}
