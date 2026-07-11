import { Injectable } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import prisma from "@tapt-api/db";

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  async check(): Promise<HealthIndicatorResult> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return this.getStatus("database", true);
    } catch {
      throw new HealthCheckError("Database check failed", this.getStatus("database", false));
    }
  }
}
