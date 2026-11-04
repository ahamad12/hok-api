import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { ApiErrorBody, FieldViolation } from "@tapt-api/api/errors";
import { Prisma } from "@tapt-api/db/prisma";
import { RequestValidationError } from "@ts-rest/nest";
import type { Request, Response } from "express";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import { ZodError } from "zod";
import { SentryService } from "../../infra/sentry/sentry.service";
import { DomainError, ErrorCode, violationsMessage } from "../errors";
import { FormValidationError } from "../errors/form-validation.error";

type ErrorPayload = ApiErrorBody["error"];

interface ResolvedException {
  status: number;
  error: ErrorPayload;
}

/** Structural view of a Zod issue — works for zod 3 and 4 alike. */
interface IssueLike {
  path: ReadonlyArray<PropertyKey>;
  code?: string;
  message?: string;
}

/**
 * Converts Zod issues to the public FieldViolation shape. `source` prefixes
 * the path with where the input came from ("body", "query", "params"), so
 * clients can map a violation back to a form field unambiguously.
 */
export function zodIssuesToViolations(
  issues: ReadonlyArray<IssueLike>,
  source?: string,
): FieldViolation[] {
  return issues.map((issue) => {
    const path = issue.path.map((p) => String(p)).join(".");
    const field = [source, path].filter(Boolean).join(".") || source || "(root)";
    return {
      field,
      code: issue.code ?? "invalid",
      message: issue.message ?? "Invalid value",
    };
  });
}

function validationError(violations: FieldViolation[]): ResolvedException {
  return {
    status: HttpStatus.BAD_REQUEST,
    error: {
      code: ErrorCode.VALIDATION_ERROR,
      message: violationsMessage(violations),
      details: { violations },
    },
  };
}

/**
 * Every error leaves the API as ApiErrorBody (packages/api/src/errors.ts):
 * a stable `code`, an optional specific `reason`, a client-safe message and
 * the request id for support. Internals (Prisma messages, constraint names,
 * stack traces) are logged, never returned.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly sentry: SentryService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const resolved = this.resolve(exception);
    const requestId = request.requestId;

    if (resolved.status >= 500) {
      this.sentry.captureException(exception, {
        path: request.url,
        method: request.method,
        requestId,
      });
    }

    this.log(exception, request, resolved);

    const body: ApiErrorBody = {
      success: false,
      error: resolved.error,
      ...(requestId ? { requestId } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    response.status(resolved.status).json(body);
  }

  resolve(exception: unknown): ResolvedException {
    if (exception instanceof DomainError) {
      return {
        status: exception.httpStatus,
        error: {
          code: exception.code,
          ...(exception.reason ? { reason: exception.reason } : {}),
          message: exception.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
      };
    }

    // ts-rest contract validation (params/query/body/headers).
    if (exception instanceof RequestValidationError) {
      return validationError([
        ...zodIssuesToViolations(exception.pathParams?.issues ?? [], "params"),
        ...zodIssuesToViolations(exception.query?.issues ?? [], "query"),
        ...zodIssuesToViolations(exception.body?.issues ?? [], "body"),
        ...zodIssuesToViolations(exception.headers?.issues ?? [], "headers"),
      ]);
    }

    if (exception instanceof ZodError) {
      return validationError(zodIssuesToViolations(exception.issues));
    }

    // Kept at 422 with its original details array — tapt-mobile's form
    // screens read details as [{ field, message }].
    if (exception instanceof FormValidationError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: exception.message,
          details: exception.errors,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    // A Prisma validation error means the server built an invalid query —
    // a bug on our side, not bad client input. Its message contains the
    // query, so it is logged but never returned.
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return this.internal();
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: { code: ErrorCode.DATABASE_INIT_ERROR, message: "Database connection failed" },
      };
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: { code: ErrorCode.DATABASE_PANIC, message: "Database engine error" },
      };
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    return this.internal();
  }

  private internal(): ResolvedException {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: ErrorCode.INTERNAL_SERVER_ERROR, message: "An unexpected error occurred" },
    };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): ResolvedException {
    switch (exception.code) {
      // Repositories translate expected P2002s into ConflictError. One that
      // reaches here is unexpected; the constraint name stays in the logs.
      case "P2002":
        return {
          status: HttpStatus.CONFLICT,
          error: { code: ErrorCode.ALREADY_EXISTS, message: "Resource already exists" },
        };
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          error: { code: ErrorCode.NOT_FOUND, message: "Resource not found" },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: { code: ErrorCode.DATABASE_ERROR, message: "A database error occurred" },
        };
    }
  }

  private resolveHttpException(exception: HttpException): ResolvedException {
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

    return { status, error: { code, message } };
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.AUTHENTICATION_ERROR;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 422:
        return ErrorCode.BUSINESS_RULE_VIOLATION;
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  private log(
    exception: unknown,
    request: Request & { requestId?: string },
    resolved: ResolvedException,
  ): void {
    const payload: Record<string, unknown> = {
      requestId: request.requestId,
      path: request.url,
      method: request.method,
      status: resolved.status,
      code: resolved.error.code,
      reason: resolved.error.reason,
      error: exception instanceof Error ? exception.message : "Unknown error",
    };
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      payload.prismaCode = exception.code;
      payload.prismaMeta = exception.meta;
    }

    if (resolved.status >= 500) {
      payload.stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error("Unhandled exception", payload);
    } else {
      this.logger.warn("Handled exception", payload);
    }
  }
}
