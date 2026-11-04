// common/logging/mask.ts — keeps credentials and PII out of logs.
//
// Applied to every log entry by the Winston format in
// infra/logger/winston.module.ts, so call sites don't have to remember.

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

// Compared after lower-casing and stripping "-" / "_", so "refresh_token",
// "Refresh-Token" and "refreshToken" all match.
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authorization",
  "cookie",
  "setcookie",
  "xapikey",
  "apikey",
  "secret",
  "clientsecret",
  "otp",
]);

const EMAIL_PATTERN = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

/** "owner@shop.test" → "o***@shop.test". Keeps the domain for debugging. */
export function maskEmail(email: string): string {
  return email.replace(EMAIL_PATTERN, "$1***@$2");
}

/** Shows only enough of a token to correlate log lines: "abcd…(64)". */
export function maskToken(token: string): string {
  if (token.length <= 8) return REDACTED;
  return `${token.slice(0, 4)}…(${token.length})`;
}

/**
 * Returns a copy of `value` with sensitive keys redacted and email
 * addresses masked in every string. Handles arrays, cycles and depth.
 * Errors are left as-is (Winston formats them separately), but their
 * messages are masked by the caller.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return maskEmail(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date || value instanceof Error) return value;
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(child, depth + 1, seen);
  }
  return out;
}

/**
 * Redacts a Winston info object IN PLACE. Winston keeps its own state
 * under Symbol keys on the same object, so it must not be replaced; only
 * string keys are touched.
 */
export function redactLogEntry<T extends Record<string, unknown>>(info: T): T {
  const entry = info as Record<string, unknown>;
  for (const key of Object.keys(entry)) {
    entry[key] = isSensitiveKey(key) ? REDACTED : redact(entry[key]);
  }
  return info;
}
