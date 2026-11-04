import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest of an opaque high-entropy token (refresh, invite,
 * password-reset, email-verify). These are random 256-bit values, not
 * passwords, so a fast hash is right: lookups stay O(1) by unique index and
 * a DB dump alone can't be replayed. Never use this for user passwords.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
