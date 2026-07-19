import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Prisma } from "@tapt-api/db/prisma";
import type { Request, Response } from "express";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import { ZodError } from "zod";
import type { SentryService } from "../../infra/sentry/sentry.service";
import { DomainError } from "../errors";

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

interface ResolvedException {
  status: number;
  body: ErrorResponseBody;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly sentry: SentryService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolve(exception, request.url);

    if (resolved.status >= 500) {
      this.sentry.captureException(exception, { path: request.url, method: request.method });
    }

    this.log(exception, request, resolved.status);

    response.status(resolved.status).json(resolved.body);
  }

  private resolve(exception: unknown, path: string): ResolvedException {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      return {
        status: exception.httpStatus,
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details !== undefined ? { details: exception.details } : {}),
          },
          timestamp,
          path,
        },
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: exception.issues,
          },
          timestamp,
          path,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception, timestamp, path);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid data provided",
            details: exception.message,
          },
          timestamp,
          path,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: {
          success: false,
          error: {
            code: "DATABASE_INIT_ERROR",
            message: "Database connection failed",
          },
          timestamp,
          path,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: {
            code: "DATABASE_PANIC",
            message: "Database engine error",
          },
          timestamp,
          path,
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception, timestamp, path);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
        },
        timestamp,
        path,
      },
    };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string,
  ): ResolvedException {
    switch (exception.code) {
      case "P2002":
        return {
          status: HttpStatus.CONFLICT,
          body: {
            success: false,
            error: {
              code: "ALREADY_EXISTS",
              message: "Resource already exists",
              details: { target: exception.meta?.target },
            },
            timestamp,
            path,
          },
        };
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            success: false,
            error: { code: "NOT_FOUND", message: "Resource not found" },
            timestamp,
            path,
          },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: {
            success: false,
            error: { code: "DATABASE_ERROR", message: "A database error occurred" },
            timestamp,
            path,
          },
        };
    }
  }

  private resolveHttpException(
    exception: HttpException,
    timestamp: string,
    path: string,
  ): ResolvedException {
    const status = exception.getStatus();
    const res = exception.getResponse();

    const rawMessage =
      typeof res === "string"
        ? res
        : ((res as Record<string, unknown>).message ?? exception.message);
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : String(rawMessage);

    const code =
      typeof res === "object" && res !== null && "code" in res
        ? String((res as Record<string, unknown>).code)
        : this.codeFromStatus(status);

    return {
      status,
      body: {
        success: false,
        error: { code, message },
        timestamp,
        path,
      },
    };
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "AUTHENTICATION_ERROR";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 422:
        return "BUSINESS_RULE_VIOLATION";
      case 429:
        return "RATE_LIMIT_EXCEEDED";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }

  private log(exception: unknown, request: Request, status: number): void {
    const message = exception instanceof Error ? exception.message : "Unknown error";
    const stack = exception instanceof Error ? exception.stack : undefined;

    const payload = {
      error: message,
      stack,
      path: request.url,
      method: request.method,
      status,
    };

    if (status >= 500) {
      this.logger.error("Unhandled exception", payload);
    } else {
      this.logger.warn("Handled exception", payload);
    }
  }
}
