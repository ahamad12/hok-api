// modules/auth/repositories/refresh-token.repository.ts — owns all
// RefreshToken persistence so TokenService (a domain service) never touches
// the ORM directly.
import { Injectable } from "@nestjs/common";
import { PrismaService, type RefreshToken } from "@tapt-api/db";
import { isNotFound } from "../../../common/prisma/errors";

export interface CreateRefreshTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
}

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
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  findByToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { token } });
  }

  // Idempotent deletes: absorbing P2025 ("record already gone") is correct
  // revoke semantics; every other failure must propagate.
  async deleteById(id: string): Promise<void> {
    try {
      await this.prisma.refreshToken.delete({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }

  async deleteByToken(token: string): Promise<void> {
    try {
      await this.prisma.refreshToken.delete({ where: { token } });
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }

  async deleteManyByUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return result.count;
  }

  async deleteExpired(asOf: Date): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: asOf } },
    });
    return result.count;
  }
}
