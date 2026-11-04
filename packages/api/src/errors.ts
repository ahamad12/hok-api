// packages/api/src/errors.ts — the error contract shared by server and clients.
//
// Every error response has this shape:
//   { success: false,
//     error: { code, reason?, message, details? },
//     requestId, timestamp, path }
//
// `code` is a stable CATEGORY that clients branch on (tapt-mobile's 401
// refresh logic keys on AUTHENTICATION_ERROR, so categories never change
// meaning). `reason` is an optional, more specific cause within that
// category, for clients that want to react precisely (e.g. force logout on
// AUTH_REFRESH_REUSED). New reasons may be added at any time; clients must
// treat an unknown reason as "no reason".

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  BAD_REQUEST: "BAD_REQUEST",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  DATABASE_INIT_ERROR: "DATABASE_INIT_ERROR",
  DATABASE_PANIC: "DATABASE_PANIC",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_REASONS = {
  // AUTHENTICATION_ERROR (401)
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_SESSION_REVOKED: "AUTH_SESSION_REVOKED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_DISABLED: "AUTH_ACCOUNT_DISABLED",
  AUTH_REFRESH_INVALID: "AUTH_REFRESH_INVALID",
  AUTH_REFRESH_EXPIRED: "AUTH_REFRESH_EXPIRED",
  AUTH_REFRESH_REUSED: "AUTH_REFRESH_REUSED",
  AUTH_SOCIAL_TOKEN_INVALID: "AUTH_SOCIAL_TOKEN_INVALID",
  // VALIDATION_ERROR / BUSINESS_RULE_VIOLATION
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  INVITE_INVALID: "INVITE_INVALID",
  ONE_TIME_TOKEN_INVALID: "ONE_TIME_TOKEN_INVALID",
} as const;

export type ErrorReason = (typeof ERROR_REASONS)[keyof typeof ERROR_REASONS];

/** One invalid input field. `field` is a dotted path, prefixed with where it
 *  came from: "body.email", "query.limit", "params.id". */
export interface FieldViolation {
  field: string;
  /** Machine-readable rule that failed (zod issue code, or e.g. "incorrect"). */
  code: string;
  message: string;
}

export interface ValidationErrorDetails {
  violations: FieldViolation[];
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode | (string & {});
    reason?: ErrorReason | (string & {});
    message: string;
    details?: unknown;
  };
  requestId?: string;
  timestamp: string;
  path: string;
}
