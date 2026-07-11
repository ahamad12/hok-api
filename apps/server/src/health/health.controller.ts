import { Controller, Get } from "@nestjs/common";
import { HealthCheckService, HealthCheck } from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./prisma-health.indicator";
import { QueueHealthIndicator } from "../infra/queue/health/queue-health.indicator";

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
    return this.health.check([
      () => this.prisma.check(),
      () => this.queue.check(),
    ]);
  }
}
