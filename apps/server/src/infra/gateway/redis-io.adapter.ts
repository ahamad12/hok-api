import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "@tapt-api/env/server";
import Redis from "ioredis";
import type { ServerOptions } from "socket.io";

/**
 * Without this, Socket.IO's default adapter keeps room membership
 * process-local: io.to(room).emit() only reaches sockets the CURRENT
 * instance accepted. emitToUser/emitToShop/emitToTenantAdmins become silent
 * no-ops for any user whose socket landed on a different pod. This adapter
 * makes every emit publish over Redis pub/sub so all instances fan out to
 * their own local sockets — this is what makes the multi-instance case
 * actually work, not just "mostly work."
 *
 * Two SEPARATE ioredis connections are required (pub + sub) — a single
 * ioredis instance cannot run normal commands once it's in subscriber
 * mode. Connection options are read from the same env vars RedisClient
 * uses, so there's one place (env.REDIS_URL) that defines "where is
 * Redis," not two configs that can drift apart.
 */
export class RedisIoAdapter extends IoAdapter {
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);

    const redisUrl = env.REDIS_URL ?? `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`;

    this.pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    // duplicate() clones connection options but NOT event listeners —
    // deliberately NOT passing enableOfflineQueue: false here. Unlike
    // request-path Redis calls (where failing fast is correct), a
    // subscriber briefly queuing during a reconnect blip is what we want:
    // losing a pub/sub reconnect window would mean missed cross-instance
    // events with no error surfaced anywhere.
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on("error", (err) => {
      // adapter is constructed before Nest's DI is fully available
      console.error("[RedisIoAdapter] pub client error — cross-instance WS delivery degraded", err);
    });
    this.subClient.on("error", (err) => {
      console.error("[RedisIoAdapter] sub client error — cross-instance WS delivery degraded", err);
    });

    server.adapter(createAdapter(this.pubClient, this.subClient));

    return server;
  }

  async close(): Promise<void> {
    await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
