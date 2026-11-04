// modules/auth/use-cases/change-password.use-case.ts — fixed: uses TokenVersionService
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  BusinessRuleError,
  ERROR_REASONS,
  FieldValidationError,
  NotFoundError,
} from "../../../common/errors";
import { UserRepository } from "../repositories/user.repository";
import { PasswordHasherService } from "../services/password-hasher.service";
import { TokenService } from "../services/token.service";
import { TokenVersionService } from "../services/token-version.service";

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  message: string;
  sessionsRevoked: number;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly tokenVersionService: TokenVersionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);

    const currentValid = await this.passwordHasher.compare(
      input.currentPassword,
      user.passwordHash,
    );
    // 400 with a field violation, not 401: the caller IS authenticated, and
    // a 401 here would make clients spend a refresh token and retry.
    if (!currentValid) {
      throw new FieldValidationError(
        [
          {
            field: "body.currentPassword",
            code: "incorrect",
            message: "The current password is incorrect",
          },
        ],
        undefined,
        ERROR_REASONS.AUTH_INVALID_CREDENTIALS,
      );
    }

    // Both the ts-rest contract (changePasswordBodySchema superRefine) and
    // this use-case call the same checkPasswordStrength — contract gives
    // early 422 on the HTTP path (TsRestHandler validates server-side), this
    // is defense-in-depth for direct use-case calls outside HTTP.
    // Register relies on contract validation alone; TsRestHandler already
    // validates server-side, so no gap — this re-check exists for symmetry
    // and direct-call safety.
    const strength = this.passwordHasher.checkStrength(input.newPassword);
    if (!strength.isValid) {
      throw new BusinessRuleError("New password does not meet strength requirements", {
        violations: strength.errors,
      });
    }

    if (await this.passwordHasher.compare(input.newPassword, user.passwordHash)) {
      throw new BusinessRuleError("New password must be different from the current password");
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.update(user.id, { passwordHash: newPasswordHash });

    // Single call site for "bump tokenVersion in Postgres AND write through
    // to Redis" — see TokenVersionService for why this can't be split
    // across call sites without risking the two falling out of sync.
    await this.tokenVersionService.invalidateSessions(user.id);
    this.eventEmitter.emit("user.password_changed", { userId: user.id });
    const sessionsRevoked = await this.tokenService.revokeAllSessions(user.id, "PASSWORD_CHANGED");

    return {
      message: "Password changed successfully. You have been logged out from all devices.",
      sessionsRevoked,
    };
  }
}
