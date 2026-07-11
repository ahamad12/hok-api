import { Inject, Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from "@nestjs/terminus";
import { PrismaService } from "@tapt-api/db";

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus("database", true);
    } catch {
      throw new HealthCheckError("Database check failed", this.getStatus("database", false));
    }
  }
}
