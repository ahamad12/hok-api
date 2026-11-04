// modules/auth/services/token.service.ts — access tokens + refresh-token sessions.

import { randomBytes, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import type { RefreshTokenRevokeReason } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { sessionRevokedKey } from "../../../common/auth/session-keys";
import { hashToken } from "../../../common/crypto/hash-token";
import { AuthenticationError, ERROR_REASONS } from "../../../common/errors";
import { RedisClient } from "../../../common/redis/redis.client";
import type { AccessTokenPayload } from "../../../common/schemas/jwt-payload.schema";
import { SESSIONS_REVOKED_EVENT, type SessionsRevokedEvent } from "../auth.events";
import {
  RefreshTokenRepository,
  type SessionMetadata,
} from "../repositories/refresh-token.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = env.JWT_REFRESH_EXPIRY_DAYS * DAY_MS;
const SESSION_MAX_MS = env.JWT_SESSION_MAX_DAYS * DAY_MS;
// Rows stay a day past expiry so a late replay still reads as reuse.
const CLEANUP_GRACE_MS = DAY_MS;

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
}

export interface RotatedSession extends IssuedSession {
  userId: string;
}

/**
 * Refresh tokens are opaque, high-entropy random values; only their
 * SHA-256 hash is persisted, so a DB dump can't be replayed. The raw value
 * is returned exactly once.
 *
 * A session is a token family: login starts it, each refresh rotates to a
 * child in the same family, and presenting an already-rotated token
 * revokes the whole family (OAuth 2.0 Security BCP refresh-token reuse
 * detection). Access tokens carry the family id as `sid`, so revoking one
 * session also blocks its live access token via Redis.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly redis: RedisClient,
    private readonly events: EventEmitter2,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign({ ...payload });
  }

  /** Starts a new session (login, registration, invite acceptance). */
  async issueSession(userId: string, meta: SessionMetadata = {}): Promise<IssuedSession> {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshToken = newRawToken();
    await this.refreshTokenRepository.create({
      userId,
      familyId: sessionId,
      token: hashToken(refreshToken),
      expiresAt: childExpiry(now, now),
      sessionStartedAt: now,
      ...meta,
    });
    return { sessionId, refreshToken };
  }

  /**
   * Exchanges a refresh token for its successor. Throws AuthenticationError
   * with a specific reason; on reuse the whole session is revoked first.
   */
  async rotate(rawToken: string, meta: SessionMetadata = {}): Promise<RotatedSession> {
    const now = new Date();
    const refreshToken = newRawToken();
    const result = await this.refreshTokenRepository.rotate(hashToken(rawToken), now, (prev) => ({
      token: hashToken(refreshToken),
      expiresAt: childExpiry(now, prev.sessionStartedAt),
      sessionStartedAt: prev.sessionStartedAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    }));

    switch (result.status) {
      case "rotated":
        return {
          userId: result.next.userId,
          sessionId: result.next.familyId,
          refreshToken,
        };
      case "reused": {
        const { userId, familyId } = result.record;
        await this.endSessions(userId, [familyId], "REUSE_DETECTED");
        throw new AuthenticationError(
          "Refresh token was already used. The session has been ended for your security.",
          ERROR_REASONS.AUTH_REFRESH_REUSED,
        );
      }
      case "expired":
        throw new AuthenticationError("Refresh token expired", ERROR_REASONS.AUTH_REFRESH_EXPIRED);
      default:
        throw new AuthenticationError("Invalid refresh token", ERROR_REASONS.AUTH_REFRESH_INVALID);
    }
  }

  /** Logout: ends the session the token belongs to. Idempotent — an unknown
   *  or already-revoked token is not an error. */
  async revokeSessionByToken(rawToken: string): Promise<void> {
    const record = await this.refreshTokenRepository.findByToken(hashToken(rawToken));
    if (!record) return;
    await this.endSessions(record.userId, [record.familyId], "LOGOUT", { notify: false });
  }

  /** Ends one of the user's own sessions. Returns false if it wasn't theirs
   *  or was already ended. */
  async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const count = await this.refreshTokenRepository.revokeUserFamily(
      userId,
      sessionId,
      "SESSION_REVOKED",
    );
    if (count === 0) return false;
    await this.blockSessionAccessTokens([sessionId]);
    this.emitRevoked({ userId, sessionIds: [sessionId], reason: "SESSION_REVOKED" });
    return true;
  }

  /** Ends every session of the user. Returns how many were live. Callers
   *  that must also kill live access tokens bump tokenVersion as well. */
  async revokeAllSessions(userId: string, reason: RefreshTokenRevokeReason): Promise<number> {
    return this.refreshTokenRepository.revokeAllForUser(userId, reason);
  }

  async listActiveSessions(userId: string) {
    return this.refreshTokenRepository.findActiveForUser(userId);
  }

  async cleanupExpiredTokens(): Promise<number> {
    return this.refreshTokenRepository.deleteExpiredBefore(new Date(Date.now() - CLEANUP_GRACE_MS));
  }

  private async endSessions(
    userId: string,
    sessionIds: string[],
    reason: RefreshTokenRevokeReason,
    { notify = true }: { notify?: boolean } = {},
  ): Promise<void> {
    for (const sessionId of sessionIds) {
      await this.refreshTokenRepository.revokeFamily(sessionId, reason);
    }
    await this.blockSessionAccessTokens(sessionIds);
    if (notify) this.emitRevoked({ userId, sessionIds, reason });
  }

  private async blockSessionAccessTokens(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      await this.redis.set(sessionRevokedKey(sessionId), "1", "EX", env.JWT_ACCESS_EXPIRY);
    }
  }

  private emitRevoked(event: SessionsRevokedEvent): void {
    this.events.emit(SESSIONS_REVOKED_EVENT, event);
  }
}

function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

/** Sliding expiry, capped at the session's absolute lifetime. */
function childExpiry(now: Date, sessionStartedAt: Date): Date {
  const sliding = now.getTime() + REFRESH_TOKEN_TTL_MS;
  const cap = sessionStartedAt.getTime() + SESSION_MAX_MS;
  return new Date(Math.min(sliding, cap));
}
