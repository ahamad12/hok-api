// modules/auth/use-cases/logout.use-case.ts — unchanged
import { Injectable } from "@nestjs/common";
import type { TokenService } from "../services/token.service";

export interface LogoutInput {
  refreshToken: string;
}
export interface LogoutResult {
  message: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(private readonly tokenService: TokenService) {}

  async execute(input: LogoutInput): Promise<LogoutResult> {
    await this.tokenService.revokeRefreshToken(input.refreshToken);
    return { message: "Logged out successfully" };
  }
}
