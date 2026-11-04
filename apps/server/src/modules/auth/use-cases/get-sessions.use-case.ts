// modules/auth/use-cases/get-sessions.use-case.ts
import { Injectable } from "@nestjs/common";
import { TokenService } from "../services/token.service";

export interface SessionResult {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class GetSessionsUseCase {
  constructor(private readonly tokenService: TokenService) {}

  /** Each active session's live token: its createdAt is the last refresh. */
  async execute(userId: string, currentSessionId?: string): Promise<{ sessions: SessionResult[] }> {
    const tokens = await this.tokenService.listActiveSessions(userId);
    return {
      sessions: tokens.map((t) => ({
        id: t.familyId,
        deviceName: t.deviceName,
        userAgent: t.userAgent,
        ipAddress: t.ipAddress,
        createdAt: t.sessionStartedAt,
        lastActiveAt: t.createdAt,
        expiresAt: t.expiresAt,
        isCurrent: t.familyId === currentSessionId,
      })),
    };
  }
}
