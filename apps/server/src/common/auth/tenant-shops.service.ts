import { Injectable } from "@nestjs/common";
import { PrismaService } from "@tapt-api/db";
import { RedisClient } from "../redis/redis.client";

const CACHE_TTL_SECONDS = 60 * 60;
const cacheKey = (tenantId: string) => `tenantshops:${tenantId}`;

/**
 * The shop ids that belong to a tenant (an OWNER's business). Resolved
 * once per request by AccessTokenVerifierService for OWNER/MANAGER and put
 * on RequestUser.tenantShopIds, so shop checks stay synchronous
 * (common/domain/shop-access.ts).
 *
 * Cached in Redis; anything that creates, deletes or transfers a shop must
 * call invalidate() so the next request sees the change.
 */
@Injectable()
export class TenantShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisClient,
  ) {}

  async getShopIds(tenantId: string): Promise<string[]> {
    const cached = await this.redis.get(cacheKey(tenantId));
    if (cached !== null) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed))
          return parsed.filter((id): id is string => typeof id === "string");
      } catch {
        // Corrupt entry: fall through and rebuild it.
      }
    }

    const shops = await this.prisma.shop.findMany({
      where: { ownerId: tenantId },
      select: { id: true },
    });
    const ids = shops.map((s) => s.id);
    await this.redis.set(cacheKey(tenantId), JSON.stringify(ids), "EX", CACHE_TTL_SECONDS);
    return ids;
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.redis.del(cacheKey(tenantId));
  }
}
