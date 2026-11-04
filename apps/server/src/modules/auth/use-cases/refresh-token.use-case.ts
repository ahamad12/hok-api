// modules/auth/use-cases/refresh-token.use-case.ts
import { Injectable } from "@nestjs/common";
import { AuthenticationError, ERROR_REASONS } from "../../../common/errors";
import { toAccessTokenPayload } from "../mappers/access-token-payload.mapper";
import type { SessionMetadata } from "../repositories/refresh-token.repository";
import { UserRepository } from "../repositories/user.repository";
import { TokenService } from "../services/token.service";

export interface RefreshTokenInput {
  refreshToken: string;
}
export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    input: RefreshTokenInput,
    client: Omit<SessionMetadata, "deviceName"> = {},
  ): Promise<RefreshTokenResult> {
    // Rotation is the atomic claim (and reuse check); it throws with a
    // specific reason when the token can't be used.
    const rotated = await this.tokenService.rotate(input.refreshToken, client);

    const user = await this.userRepository.findById(rotated.userId);
    if (!user || !user.isActive) {
      await this.tokenService.revokeSessionByToken(rotated.refreshToken);
      throw user
        ? new AuthenticationError("Account is deactivated", ERROR_REASONS.AUTH_ACCOUNT_DISABLED)
        : new AuthenticationError("Invalid refresh token", ERROR_REASONS.AUTH_REFRESH_INVALID);
    }

    const accessToken = this.tokenService.generateAccessToken(
      toAccessTokenPayload(user, rotated.sessionId),
    );
    return { accessToken, refreshToken: rotated.refreshToken, sessionId: rotated.sessionId };
  }
}
