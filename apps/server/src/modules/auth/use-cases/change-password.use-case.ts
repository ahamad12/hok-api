// modules/auth/use-cases/change-password.use-case.ts — fixed: uses TokenVersionService
import { Injectable } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { AuthenticationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import type { UserRepository } from "../repositories/user.repository";
import type { PasswordHasherService } from "../services/password-hasher.service";
import type { TokenService } from "../services/token.service";
import type { TokenVersionService } from "../services/token-version.service";

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
    if (!currentValid) throw new AuthenticationError("The current password is incorrect");

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
    const sessionsRevoked = await this.tokenService.revokeAllUserTokens(user.id);

    return {
      message: "Password changed successfully. You have been logged out from all devices.",
      sessionsRevoked,
    };
  }
}
