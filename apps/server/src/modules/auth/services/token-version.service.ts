// modules/auth/services/token-version.service.ts — new: single call site for
// the "bump DB + write through to Redis" pairing, so no mutation site can
// forget the Redis half and silently break instant invalidation.
import { Injectable } from "@nestjs/common";
import type { RedisClient } from "../../../common/redis/redis.client";
import type { UserRepository } from "../repositories/user.repository";

const TOKEN_VERSION_CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class TokenVersionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redis: RedisClient,
  ) {}

  /** Call this from anywhere that should kill a user's existing sessions:
   *  change-password, deactivate, role change, supervisor toggle, shop
   *  reassignment. */
  async invalidateSessions(userId: string): Promise<number> {
    const newVersion = await this.userRepository.incrementTokenVersion(userId);
    await this.redis.set(`tokenver:${userId}`, newVersion, "EX", TOKEN_VERSION_CACHE_TTL_SECONDS);
    return newVersion;
  }
}
