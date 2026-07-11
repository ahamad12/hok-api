import { Injectable } from "@nestjs/common";
import { env } from "@tapt-api/env/server";
import * as bcrypt from "bcrypt";

export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
}

/**
 * PasswordHasherService handles all cryptographic operations for user passwords.
 * Injected as a provider to allow for easy mocking in unit tests.
 */
@Injectable()
export class PasswordHasherService {
  // Uses environment configuration for salt rounds, defaulting to 12
  private readonly saltRounds = env.BCRYPT_SALT_ROUNDS ?? 12;

  /**
   * Hashes a plaintext password using bcrypt.
   * @param password Plaintext password
   * @returns Hashed string
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compares a plaintext password against a stored hash.
   * bcrypt.compare handles the timing-safe comparison internally.
   * @param password Plaintext password
   * @param hash Stored hash
   * @returns Boolean indicating match
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validates password strength against security policy rules.
   * Returns all violated rules at once to provide better UX feedback.
   * @param password Plaintext password
   * @returns Object containing boolean status and list of error messages
   */
  checkStrength(password: string): PasswordStrengthResult {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return { isValid: errors.length === 0, errors };
  }
}
