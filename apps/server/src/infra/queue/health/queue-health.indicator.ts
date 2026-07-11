import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from "@nestjs/terminus";
import type { Queue } from "bullmq";

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue("email") private readonly emailQueue: Queue,
    @InjectQueue("notification") private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async check(): Promise<HealthIndicatorResult> {
    const results: Record<string, boolean> = {};

    try {
      await this.emailQueue.client;
      results.email = true;
    } catch {
      results.email = false;
    }

    try {
      await this.notificationQueue.client;
      results.notification = true;
    } catch {
      results.notification = false;
    }

    const allHealthy = Object.values(results).every(Boolean);
    if (!allHealthy) {
      throw new HealthCheckError("Queue check failed", this.getStatus("queue", allHealthy));
    }

    return this.getStatus("queue", true);
  }
}
