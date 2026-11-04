// modules/auth/services/password-hasher.service.ts
import { Injectable } from "@nestjs/common";
import {
  checkPasswordStrength,
  type PasswordStrengthResult,
} from "@tapt-api/api/validators/password-strength";
import { env } from "@tapt-api/env/server";
import * as bcrypt from "bcrypt";

const SALT_ROUNDS = env.BCRYPT_SALT_ROUNDS;

export type { PasswordStrengthResult };

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Thin delegate, not a second implementation — the actual rules live in
   * packages/api/src/validators/password-strength.ts, a plain dependency-
   * free function, so both this service AND the ts-rest contract's
   * .superRefine() call the exact same code instead of maintaining two
   * copies of "what counts as a strong password" that can silently drift.
   */
  checkStrength(password: string): PasswordStrengthResult {
    return checkPasswordStrength(password);
  }
}
