export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

export const ERROR_CODE_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = Object.freeze({
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.AUTHENTICATION_ERROR]: 401,
  [ErrorCode.AUTHORIZATION_ERROR]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
});

export abstract class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = ERROR_CODE_HTTP_STATUS[code];
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = "Authentication failed", details?: unknown) {
    super(message, ErrorCode.AUTHENTICATION_ERROR, details);
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
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.BUSINESS_RULE_VIOLATION, details);
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

  constructor(message: string, field?: string) {
    super(message, ErrorCode.VALIDATION_ERROR, field ? { field } : undefined);
    this.field = field;
  }
}
