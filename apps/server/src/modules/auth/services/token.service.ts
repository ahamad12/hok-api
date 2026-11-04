// modules/auth/services/token.service.ts — fixed: refresh tokens hashed at rest

import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { env } from "@tapt-api/env/server";
import { AuthenticationError } from "../../../common/errors";
import type { AccessTokenPayload } from "../../../common/schemas/jwt-payload.schema";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";

const REFRESH_TOKEN_TTL_DAYS = env.JWT_REFRESH_EXPIRY_DAYS;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Refresh tokens are opaque, high-entropy random values. Only their
 * SHA-256 hash is ever persisted — a DB dump alone can't be replayed as
 * a live session. The raw value is returned to the caller exactly once,
 * at generation time, and never stored anywhere again.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign({ ...payload });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.refreshTokenRepository.create({
      userId,
      token: hashToken(rawToken), // column holds the hash, not the raw value
      expiresAt,
    });

    return rawToken;
  }

  async verifyRefreshToken(rawToken: string): Promise<string> {
    const record = await this.refreshTokenRepository.findByToken(hashToken(rawToken));
    if (!record) throw new AuthenticationError("Invalid refresh token");

    if (record.expiresAt < new Date()) {
      await this.refreshTokenRepository.deleteById(record.id);
      throw new AuthenticationError("Refresh token expired");
    }

    return record.userId;
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.refreshTokenRepository.deleteByToken(hashToken(rawToken)); // idempotent — revoking an unknown token is not an error
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    return this.refreshTokenRepository.deleteManyByUser(userId);
  }

  async cleanupExpiredTokens(): Promise<number> {
    return this.refreshTokenRepository.deleteExpired(new Date());
  }
}
