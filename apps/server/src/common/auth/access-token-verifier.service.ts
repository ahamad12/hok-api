import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRepository } from "../../modules/auth/repositories/user.repository";
import { AuthenticationError } from "../errors";
import { RedisClient } from "../redis/redis.client";
import { accessTokenPayloadSchema } from "../schemas/jwt-payload.schema";
import type { RequestUser } from "../types/request-user.interface";

const TOKEN_VERSION_CACHE_TTL_SECONDS = 60 * 60;

/**
 * The ONE place "verify a JWT and check it hasn't been invalidated by a
 * tokenVersion bump" is implemented. Both JwtAuthGuard (HTTP) and
 * AppGateway (WebSocket) call this rather than each carrying their own
 * copy — a prior draft of the gateway spec had the WS side re-implement
 * this inline, which is exactly the two-sources-of-truth problem this
 * project has been actively removing elsewhere (see jwt-payload.schema.ts,
 * user-role-invariants.ts). If the cache key format, TTL, or verification
 * steps ever need to change, they change here once for both transports.
 */
@Injectable()
export class AccessTokenVerifierService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisClient,
    private readonly userRepository: UserRepository,
  ) {}

  async verify(rawToken: string): Promise<RequestUser> {
    let decoded: unknown;
    try {
      decoded = await this.jwtService.verifyAsync(rawToken);
    } catch {
      throw new AuthenticationError("Invalid or expired token");
    }

    const parsed = accessTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new AuthenticationError("Malformed token payload");
    }

    const { userId, email, role, shopId, isSupervisor, tokenVersion } = parsed.data;

    const currentVersion = await this.getCurrentTokenVersion(userId);
    if (currentVersion === null || currentVersion !== tokenVersion) {
      throw new AuthenticationError("Session invalidated. Please login again.");
    }

    return { userId, email, role, shopId, isSupervisor };
  }

  private async getCurrentTokenVersion(userId: string): Promise<number | null> {
    const cached = await this.redis.get(`tokenver:${userId}`);
    if (cached !== null) return Number(cached);

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) return null;

    await this.redis.set(
      `tokenver:${userId}`,
      user.tokenVersion,
      "EX",
      TOKEN_VERSION_CACHE_TTL_SECONDS,
    );
    return user.tokenVersion;
  }
}
