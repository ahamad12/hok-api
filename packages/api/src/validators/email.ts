// packages/api/src/validators/email.ts — one definition of "the same email".
//
// Emails are stored trimmed and lower-cased, and every lookup normalises
// first, so "Owner@Shop.test " and "owner@shop.test" are one account. Used
// by the contracts (emailSchema) and server-side (UserRepository), the same
// way password-strength.ts is shared.
import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
