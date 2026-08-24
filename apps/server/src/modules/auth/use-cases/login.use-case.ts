// modules/auth/use-cases/login.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { AuthenticationError } from "../../../common/errors";
import { UserRepository } from "../repositories/user.repository";
import { PasswordHasherService } from "../services/password-hasher.service";
import { TokenService } from "../services/token.service";

export interface LoginInput {
  email: string;
  password: string;
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
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) throw new AuthenticationError("Invalid email or password");
    if (!user.isActive) {
      throw new AuthenticationError("Account is deactivated. Please contact your administrator.");
    }

    const passwordValid = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!passwordValid) throw new AuthenticationError("Invalid email or password");

    const accessToken = this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
      isSupervisor: user.isSupervisor,
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

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
    };
  }
}
