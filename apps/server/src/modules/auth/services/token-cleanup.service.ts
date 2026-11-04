import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { env } from "@tapt-api/env/server";
import { TokenService } from "./token.service";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Periodic GC for expired refresh-token rows. verifyRefreshToken() deletes
 * rows lazily on access, but tokens that are never replayed would otherwise
 * accumulate forever — nothing else called cleanupExpiredTokens().
 */
@Injectable()
export class TokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly tokenService: TokenService) {}

  onModuleInit() {
    if (env.NODE_ENV === "test") return;
    void this.tokenService.cleanupExpiredTokens().catch(() => {});
    this.timer = setInterval(() => {
      void this.tokenService.cleanupExpiredTokens().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
