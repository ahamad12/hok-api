import { Injectable } from "@nestjs/common";
import { PrismaService, type ProfitReport } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { NotFoundError } from "../../../common/errors";

@Injectable()
export class ProfitReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ProfitReport | null> {
    return this.prisma.profitReport.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<ProfitReport> {
    const report = await this.findById(id);
    if (!report) throw new NotFoundError("ProfitReport", id);
    return report;
  }

  // No @@unique on Prisma-visible columns — "one live report per period"
  // lives in a partial index the client can't see, so P2002 isn't expected here.
  create(data: Prisma.ProfitReportUncheckedCreateInput): Promise<ProfitReport> {
    return this.prisma.profitReport.create({ data });
  }

  async findAll(params: {
    shopId: string;
    periodStart?: Date;
    periodEnd?: Date;
    includeVoided?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ reports: ProfitReport[]; total: number }> {
    const where: Prisma.ProfitReportWhereInput = {
      shopId: params.shopId,
      ...(!params.includeVoided && { voidedAt: null }),
      ...((params.periodStart || params.periodEnd) && {
        ...(params.periodStart ? { periodStart: { gte: params.periodStart } } : {}),
        ...(params.periodEnd ? { periodEnd: { lte: params.periodEnd } } : {}),
      }),
    };

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.profitReport.findMany({
        where,
        orderBy: { generatedAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.profitReport.count({ where }),
    ]);

    return { reports, total };
  }

  findLatest(shopId: string): Promise<ProfitReport | null> {
    return this.prisma.profitReport.findFirst({
      where: { shopId, voidedAt: null },
      orderBy: { generatedAt: "desc" },
    });
  }

  async voidIfNotVoided(
    id: string,
    data: { voidedById: string; voidReason: string },
  ): Promise<number> {
    const result = await this.prisma.profitReport.updateMany({
      where: { id, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: data.voidedById, voidReason: data.voidReason },
    });
    return result.count;
  }
}
