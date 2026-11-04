// modules/auth/use-cases/logout-all.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SESSIONS_REVOKED_EVENT, type SessionsRevokedEvent } from "../auth.events";
import { TokenService } from "../services/token.service";
import { TokenVersionService } from "../services/token-version.service";

export interface LogoutAllResult {
  message: string;
  sessionsRevoked: number;
}

/** "Sign out everywhere": ends every refresh session and, via tokenVersion,
 *  every live access token — including the caller's. */
@Injectable()
export class LogoutAllUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly tokenVersionService: TokenVersionService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(userId: string): Promise<LogoutAllResult> {
    const sessionsRevoked = await this.tokenService.revokeAllSessions(userId, "LOGOUT_ALL");
    await this.tokenVersionService.invalidateSessions(userId);
    this.events.emit(SESSIONS_REVOKED_EVENT, {
      userId,
      reason: "LOGOUT_ALL",
    } satisfies SessionsRevokedEvent);
    return { message: "Signed out from all devices", sessionsRevoked };
  }
}
