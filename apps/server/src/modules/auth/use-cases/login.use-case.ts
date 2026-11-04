// modules/auth/use-cases/login.use-case.ts
import { Injectable } from "@nestjs/common";
import { normalizeEmail } from "@tapt-api/api/validators/email";
import type { UserRole } from "@tapt-api/db";
import { AuthenticationError, ERROR_REASONS } from "../../../common/errors";
import { toAccessTokenPayload } from "../mappers/access-token-payload.mapper";
import type { SessionMetadata } from "../repositories/refresh-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { PasswordHasherService } from "../services/password-hasher.service";
import { TokenService } from "../services/token.service";

export interface LoginInput {
  email: string;
  password: string;
  deviceName?: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    username: string | null;
    role: UserRole;
    shopId: string | null;
    isSupervisor: boolean;
  };
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    input: LoginInput,
    client: Omit<SessionMetadata, "deviceName"> = {},
  ): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(normalizeEmail(input.email));

    // Always do exactly one bcrypt compare, and give unknown email and wrong
    // password the same error, so neither the response nor its timing
    // reveals whether an account exists.
    const passwordValid = user
      ? await this.passwordHasher.compare(input.password, user.passwordHash)
      : await this.passwordHasher.compareDummy(input.password);
    if (!user || !passwordValid) {
      throw new AuthenticationError(
        "Invalid email or password",
        ERROR_REASONS.AUTH_INVALID_CREDENTIALS,
      );
    }

    // Only revealed to someone who proved they know the password.
    if (!user.isActive) {
      throw new AuthenticationError(
        "Account is deactivated. Please contact your administrator.",
        ERROR_REASONS.AUTH_ACCOUNT_DISABLED,
      );
    }

    const { sessionId, refreshToken } = await this.tokenService.issueSession(user.id, {
      ...client,
      deviceName: input.deviceName ?? null,
    });
    const accessToken = this.tokenService.generateAccessToken(
      toAccessTokenPayload(user, sessionId),
    );

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        role: user.role,
        shopId: user.shopId,
        isSupervisor: user.isSupervisor,
      },
      accessToken,
      refreshToken,
      sessionId,
    };
  }
}
