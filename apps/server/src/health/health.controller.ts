import { Controller, Get, Inject } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { Public } from "../common/decorators/public.decorator";
import { QueueHealthIndicator } from "../infra/queue/health/queue-health.indicator";
import { PrismaHealthIndicator } from "./prisma-health.indicator";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator) private readonly prisma: PrismaHealthIndicator,
    @Inject(QueueHealthIndicator) private readonly queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prisma.check(), () => this.queue.check()]);
  }
}
