// common/redis/redis.client.ts
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { env } from "@tapt-api/env/server";
import Redis from "ioredis";

@Injectable()
export class RedisClient extends Redis implements OnModuleDestroy {
  constructor() {
    super(env.REDIS_URL ?? `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
