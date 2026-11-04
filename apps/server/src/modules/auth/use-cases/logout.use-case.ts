// modules/auth/use-cases/logout.use-case.ts
import { Injectable } from "@nestjs/common";
import { TokenService } from "../services/token.service";

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
    // Ends the whole session (token family), not just this one token.
    await this.tokenService.revokeSessionByToken(input.refreshToken);
    return { message: "Logged out successfully" };
  }
}
