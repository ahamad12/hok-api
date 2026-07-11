import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { QueueHealthIndicator } from "../infra/queue/health/queue-health.indicator";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./prisma-health.indicator";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
