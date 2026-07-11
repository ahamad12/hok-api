import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from "@nestjs/terminus";
import type { Queue } from "bullmq";

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {
    super();
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.emailQueue.client;
      return this.getStatus("queue", true);
    } catch {
      throw new HealthCheckError("Queue check failed", this.getStatus("queue", false));
    }
  }
}
