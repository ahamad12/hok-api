// modules/auth/use-cases/revoke-session.use-case.ts
import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors";
import { TokenService } from "../services/token.service";

@Injectable()
export class RevokeSessionUseCase {
  constructor(private readonly tokenService: TokenService) {}

  /** Ends one of the caller's own sessions (e.g. a lost phone). Another
   *  user's session id is indistinguishable from an unknown one: 404. */
  async execute(userId: string, sessionId: string): Promise<{ message: string }> {
    const revoked = await this.tokenService.revokeSessionById(userId, sessionId);
    if (!revoked) throw new NotFoundError("Session", sessionId);
    return { message: "Session ended" };
  }
}
