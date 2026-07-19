// modules/auth/services/token.service.ts — fixed: refresh tokens hashed at rest

import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { PrismaService } from "@tapt-api/db";
import { AuthenticationError } from "../../../common/errors";
import type { AccessTokenPayload } from "../../../common/schemas/jwt-payload.schema";

const REFRESH_TOKEN_TTL_DAYS = 7;

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
    private readonly prisma: PrismaService,
  ) {}

  generateAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign({ ...payload });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        user: { connect: { id: userId } },
        token: hashToken(rawToken), // column holds the hash, not the raw value
        expiresAt,
      },
    });

    return rawToken;
  }

  async verifyRefreshToken(rawToken: string): Promise<string> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(rawToken) },
    });
    if (!record) throw new AuthenticationError("Invalid refresh token");

    if (record.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => undefined);
      throw new AuthenticationError("Refresh token expired");
    }

    return record.userId;
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken
      .delete({ where: { token: hashToken(rawToken) } })
      .catch(() => undefined); // idempotent — revoking an unknown token is not an error
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return result.count;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
