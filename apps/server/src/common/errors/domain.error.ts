import {
  ERROR_CODES,
  type ErrorCode as ErrorCodeType,
  type ErrorReason,
  type FieldViolation,
} from "@tapt-api/api/errors";

export { ERROR_REASONS } from "@tapt-api/api/errors";
export type { ErrorReason, FieldViolation };

// Value + type of the same name, so existing `ErrorCode.NOT_FOUND` call
// sites and `code: ErrorCode` annotations keep working. The source of truth
// is the shared contract in packages/api/src/errors.ts.
export const ErrorCode = ERROR_CODES;
export type ErrorCode = ErrorCodeType;

export const ERROR_CODE_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = Object.freeze({
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.AUTHENTICATION_ERROR]: 401,
  [ErrorCode.AUTHORIZATION_ERROR]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.DATABASE_INIT_ERROR]: 503,
  [ErrorCode.DATABASE_PANIC]: 500,
});

export abstract class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;
  /** Optional specific cause within `code` — see ERROR_REASONS. */
  public readonly reason?: ErrorReason;

  constructor(message: string, code: ErrorCode, details?: unknown, reason?: ErrorReason) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = ERROR_CODE_HTTP_STATUS[code];
    this.details = details;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = "Authentication failed", reason?: ErrorReason) {
    super(message, ErrorCode.AUTHENTICATION_ERROR, undefined, reason);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = "Insufficient permissions", details?: unknown) {
    super(message, ErrorCode.AUTHORIZATION_ERROR, details);
  }
}

export class BadRequestError extends DomainError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, ErrorCode.INVALID_INPUT, details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, details?: unknown, reason?: ErrorReason) {
    super(message, ErrorCode.BUSINESS_RULE_VIOLATION, details, reason);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CONFLICT, details);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.EXTERNAL_SERVICE_ERROR, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.FORBIDDEN, details);
  }
}

export class InternalServerError extends DomainError {
  constructor(message = "Internal server error", details?: unknown) {
    super(message, ErrorCode.INTERNAL_SERVER_ERROR, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, identifier?: string | number) {
    const message =
      identifier !== undefined
        ? `${resource} with identifier '${identifier}' was not found`
        : `${resource} was not found`;
    super(message, ErrorCode.NOT_FOUND, { resource, identifier });
  }
}

export class RateLimitError extends DomainError {
  constructor(message = "Rate limit exceeded", details?: unknown) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, details);
  }
}

export class ValidationError extends DomainError {
  public readonly field?: string;

  constructor(message: string, field?: string, reason?: ErrorReason) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      field ? { violations: [{ field, code: "invalid", message }] } : undefined,
      reason,
    );
    this.field = field;
  }
}

/** 400 with one or more field violations — the same shape the global filter
 *  produces for contract (Zod) validation failures. */
export class FieldValidationError extends DomainError {
  public readonly violations: FieldViolation[];

  constructor(violations: FieldViolation[], message?: string, reason?: ErrorReason) {
    super(
      message ?? violationsMessage(violations),
      ErrorCode.VALIDATION_ERROR,
      { violations },
      reason,
    );
    this.violations = violations;
  }
}

export function violationsMessage(violations: FieldViolation[]): string {
  if (violations.length === 1 && violations[0]) return violations[0].message;
  return "Some fields are invalid. Please correct them and try again.";
}
