import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { QueueModule } from "../infra/queue/queue.module";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./prisma-health.indicator";

@Module({
  imports: [TerminusModule, QueueModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
