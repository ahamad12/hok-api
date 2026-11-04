// modules/auth/use-cases/refresh-token.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import { AuthenticationError, ERROR_REASONS } from "../../../common/errors";
import { UserRepository } from "../repositories/user.repository";
import { TokenService } from "../services/token.service";

export interface RefreshTokenInput {
  refreshToken: string;
}
export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenResult> {
    const userId = await this.tokenService.verifyRefreshToken(input.refreshToken);
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError("Invalid refresh token", ERROR_REASONS.AUTH_REFRESH_INVALID);
    }
    if (!user.isActive) {
      throw new AuthenticationError("Account is deactivated", ERROR_REASONS.AUTH_ACCOUNT_DISABLED);
    }

    await this.tokenService.revokeRefreshToken(input.refreshToken);

    const accessToken = this.tokenService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
      isSupervisor: user.isSupervisor,
      tokenVersion: user.tokenVersion,
    });
    const newRefreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
