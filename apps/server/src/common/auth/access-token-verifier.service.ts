import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@tapt-api/db";
import { UserRepository } from "../../modules/auth/repositories/user.repository";
import { AuthenticationError, ERROR_REASONS } from "../errors";
import { RedisClient } from "../redis/redis.client";
import { accessTokenPayloadSchema } from "../schemas/jwt-payload.schema";
import type { RequestUser } from "../types/request-user.interface";
import { sessionRevokedKey } from "./session-keys";
import { TenantShopsService } from "./tenant-shops.service";

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
    private readonly tenantShops: TenantShopsService,
  ) {}

  async verify(rawToken: string): Promise<RequestUser> {
    let decoded: unknown;
    try {
      decoded = await this.jwtService.verifyAsync(rawToken);
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw new AuthenticationError("Access token expired", ERROR_REASONS.AUTH_TOKEN_EXPIRED);
      }
      throw new AuthenticationError("Invalid access token", ERROR_REASONS.AUTH_TOKEN_INVALID);
    }

    const parsed = accessTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new AuthenticationError("Malformed token payload", ERROR_REASONS.AUTH_TOKEN_INVALID);
    }

    const { userId, email, role, shopId, isSupervisor, tokenVersion, sid, tid } = parsed.data;

    // Tokens minted before tenancy carry no `tid`. Reject them so the
    // client refreshes into a token that does (≤ 15 min after deploy).
    if (tid === undefined) {
      throw new AuthenticationError(
        "Token predates tenant scoping",
        ERROR_REASONS.AUTH_TOKEN_INVALID,
      );
    }

    const currentVersion = await this.getCurrentTokenVersion(userId);
    // tokenVersion kills every session of the user; sessrev:<sid> kills one.
    const sessionRevoked = sid ? (await this.redis.get(sessionRevokedKey(sid))) !== null : false;
    if (currentVersion === null || currentVersion !== tokenVersion || sessionRevoked) {
      throw new AuthenticationError(
        "Session invalidated. Please login again.",
        ERROR_REASONS.AUTH_SESSION_REVOKED,
      );
    }

    // STAFF are scoped by shopId; OWNER/MANAGER by their tenant's shops.
    const tenantShopIds =
      role !== UserRole.STAFF && tid ? await this.tenantShops.getShopIds(tid) : undefined;

    return {
      userId,
      email,
      role,
      shopId,
      isSupervisor,
      tenantId: tid,
      ...(sid ? { sessionId: sid } : {}),
      ...(tenantShopIds ? { tenantShopIds } : {}),
    };
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
