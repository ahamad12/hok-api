import { InjectQueue } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AUTH_MAINTENANCE_QUEUE, CLEANUP_REFRESH_TOKENS_JOB } from "./auth-maintenance.constants";

/**
 * Schedules daily refresh-token GC as a BullMQ repeatable job. A fixed
 * jobId makes the schedule idempotent, so with N replicas it still runs
 * once a day (a per-process setInterval would run N times).
 */
@Injectable()
export class AuthMaintenanceProducer implements OnModuleInit {
  constructor(@InjectQueue(AUTH_MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      CLEANUP_REFRESH_TOKENS_JOB,
      {},
      { repeat: { pattern: "30 3 * * *" }, jobId: "auth-cleanup-refresh-tokens-daily" },
    );
  }
}
