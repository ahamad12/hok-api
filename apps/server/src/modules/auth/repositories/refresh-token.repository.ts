// modules/auth/repositories/refresh-token.repository.ts — owns all
// RefreshToken persistence so TokenService (a domain service) never touches
// the ORM directly.
import { Injectable } from "@nestjs/common";
import { PrismaService, type RefreshToken, type RefreshTokenRevokeReason } from "@tapt-api/db";

export interface SessionMetadata {
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CreateRefreshTokenData extends SessionMetadata {
  userId: string;
  familyId: string;
  /** SHA-256 of the raw token — never the raw value. */
  token: string;
  expiresAt: Date;
  sessionStartedAt: Date;
}

export type RotateResult =
  | { status: "rotated"; previous: RefreshToken; next: RefreshToken }
  /** Presented token was already rotated: someone is replaying it. */
  | { status: "reused"; record: RefreshToken }
  /** Revoked for another reason (logout, session revoked, password change). */
  | { status: "revoked"; record: RefreshToken }
  | { status: "expired"; record: RefreshToken }
  | { status: "unknown" };

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  // No P2002 handling here: token is @unique, but a collision on a 256-bit
  // random value indicates a CSPRNG failure, not a domain conflict — let it
  // surface as a 500 rather than translating it into a ConflictError.
  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return await this.prisma.refreshToken.create({
      data: {
        user: { connect: { id: data.userId } },
        familyId: data.familyId,
        token: data.token,
        expiresAt: data.expiresAt,
        sessionStartedAt: data.sessionStartedAt,
        deviceName: data.deviceName ?? null,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }

  findByToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { token } });
  }

  /**
   * Atomically swaps the presented token for its child.
   *
   * The guarded updateMany (revokedAt IS NULL AND not expired) is the claim:
   * of two concurrent refreshes with the same token exactly one gets
   * count = 1. The loser — and any later replay — sees a ROTATED row and is
   * reported as reuse. Same pattern as delivery.repository.ts payments.
   *
   * `buildNext` receives the claimed row so the caller can derive the
   * child's expiry from the session start.
   */
  async rotate(
    presentedHash: string,
    now: Date,
    buildNext: (previous: RefreshToken) => Omit<CreateRefreshTokenData, "userId" | "familyId">,
  ): Promise<RotateResult> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { token: presentedHash, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, revokeReason: "ROTATED" },
      });

      const previous = await tx.refreshToken.findUnique({ where: { token: presentedHash } });
      if (!previous) return { status: "unknown" } as const;

      if (claimed.count === 0) {
        if (previous.revokeReason === "ROTATED")
          return { status: "reused", record: previous } as const;
        if (previous.revokedAt) return { status: "revoked", record: previous } as const;
        return { status: "expired", record: previous } as const;
      }

      const nextData = buildNext(previous);
      const next = await tx.refreshToken.create({
        data: {
          userId: previous.userId,
          familyId: previous.familyId,
          token: nextData.token,
          expiresAt: nextData.expiresAt,
          sessionStartedAt: previous.sessionStartedAt,
          deviceName: nextData.deviceName ?? previous.deviceName,
          userAgent: nextData.userAgent ?? previous.userAgent,
          ipAddress: nextData.ipAddress ?? previous.ipAddress,
        },
      });
      await tx.refreshToken.update({
        where: { id: previous.id },
        data: { replacedById: next.id },
      });
      return { status: "rotated", previous, next } as const;
    });
  }

  /** Revokes every live token in one session. Returns how many were live. */
  async revokeFamily(
    familyId: string,
    reason: RefreshTokenRevokeReason,
    now = new Date(),
  ): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    return result.count;
  }

  /** Same as revokeFamily, but only if the session belongs to `userId` —
   *  so a user can't revoke someone else's session by guessing its id. */
  async revokeUserFamily(
    userId: string,
    familyId: string,
    reason: RefreshTokenRevokeReason,
    now = new Date(),
  ): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    return result.count;
  }

  /**
   * Revokes all of a user's live sessions. Returns the number of distinct
   * sessions ended (each live session has exactly one live token).
   */
  async revokeAllForUser(
    userId: string,
    reason: RefreshTokenRevokeReason,
    now = new Date(),
  ): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, revokeReason: reason },
    });
    // Also close out already-expired-but-unrevoked rows so they read as
    // ended in audit; they don't count as sessions.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    return result.count;
  }

  /** The live token of each active session, newest activity first. */
  findActiveForUser(userId: string, now = new Date()): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * GC. Rows are kept until they expire (plus a grace period) because a
   * revoked-but-unexpired row is what makes reuse detectable. After expiry
   * the token can't be accepted anyway, so the row has no further use.
   */
  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return result.count;
  }
}
