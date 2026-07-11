import { Controller, Get } from "@nestjs/common";
import { HealthCheck, type HealthCheckService } from "@nestjs/terminus";
import type { QueueHealthIndicator } from "../infra/queue/health/queue-health.indicator";
import type { PrismaHealthIndicator } from "./prisma-health.indicator";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prisma.check(), () => this.queue.check()]);
  }
}
