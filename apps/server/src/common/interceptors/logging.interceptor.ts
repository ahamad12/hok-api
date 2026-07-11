import { Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { Observable, tap } from "rxjs";
import * as crypto from "crypto";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, headers } = req;

    const requestId = headers["x-request-id"] || crypto.randomUUID();
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
            headers,
          };

          if (statusCode >= 400 && statusCode < 500) {
            this.logger.warn(`[${method}] ${originalUrl} ${statusCode} - ${durationMs}ms`, logData);
          } else {
            this.logger.info(`[${method}] ${originalUrl} ${statusCode} - ${durationMs}ms`, logData);
          }
        },
      }),
    );
  }
}
