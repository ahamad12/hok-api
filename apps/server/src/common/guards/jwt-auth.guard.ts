// common/guards/jwt-auth.guard.ts — fixed: SSOT schema, tokenVersion enforced, no cast
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { UserRepository } from "../../modules/auth/repositories/user.repository";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthenticationError } from "../errors";
import type { RedisClient } from "../redis/redis.client";
import { accessTokenPayloadSchema } from "../schemas/jwt-payload.schema";

const TOKEN_VERSION_CACHE_TTL_SECONDS = 60 * 60; // hygiene only — not the security boundary

/**
 * Registered as APP_GUARD from *inside* AuthModule (see auth.module.ts),
 * not from AppModule. This is what lets it inject UserRepository directly
 * with zero circular-import risk — there is no separate "Users module"
 * this needs to reach into, and there never needed to be one for this.
 *
 * tokenVersion enforcement is cache-aside, not a hard DB read on every
 * request and not blind trust of the JWT claim either:
 *  - Redis hit  -> compare against cached version, no DB hit.
 *  - Redis miss -> read live tokenVersion from Postgres, populate Redis,
 *    then compare. TTL is 1h purely so stale entries don't linger forever
 *    in memory; the actual invalidation guarantee comes from every
 *    tokenVersion-bumping mutation writing through to Redis synchronously
 *    (see TokenVersionService), not from this TTL expiring.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redis: RedisClient,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) throw new AuthenticationError("Missing bearer token");

    let decoded: unknown;
    try {
      decoded = await this.jwtService.verifyAsync(token);
    } catch {
      throw new AuthenticationError("Invalid or expired token");
    }

    const parsed = accessTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) throw new AuthenticationError("Malformed token payload");

    const { userId, email, role, shopId, isSupervisor, tokenVersion } = parsed.data;

    const currentVersion = await this.getCurrentTokenVersion(userId);
    if (currentVersion === null || currentVersion !== tokenVersion) {
      throw new AuthenticationError("Session invalidated. Please login again.");
    }

    request.user = { userId, email, role, shopId, isSupervisor };
    return true;
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

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, token] = header.split(" ");
    return scheme === "Bearer" && token ? token : undefined;
  }
}
