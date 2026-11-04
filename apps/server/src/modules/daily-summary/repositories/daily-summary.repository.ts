import { Injectable } from "@nestjs/common";
import type { DailySummaryStatus } from "@tapt-api/db";
import { type DailySummary, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class DailySummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<DailySummary | null> {
    return this.prisma.dailySummary.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<DailySummary> {
    const summary = await this.findById(id);
    if (!summary) throw new NotFoundError("DailySummary", id);
    return summary;
  }

  // Latest non-voided summary before this date — used to auto-chain
  // openingBalance from the prior day's closingBalance. Any status
  // (draft or finalized) is considered "the best known cash position,"
  // since a draft still reflects a real count that was performed.
  async findLatestBefore(shopId: string, date: Date): Promise<DailySummary | null> {
    return this.prisma.dailySummary.findFirst({
      where: { shopId, date: { lt: date }, voidedAt: null },
      orderBy: { date: "desc" },
    });
  }

  async create(data: Prisma.DailySummaryUncheckedCreateInput): Promise<DailySummary> {
    try {
      return await this.prisma.dailySummary.create({ data });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictError(
          "A daily summary for this date already exists — void it before creating a new one",
        );
      }
      throw e;
    }
  }

  async findAll(params: {
    shopId: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: DailySummaryStatus;
    limit: number;
    offset: number;
  }): Promise<{ summaries: DailySummary[]; total: number }> {
    const where: Prisma.DailySummaryWhereInput = {
      shopId: params.shopId,
      voidedAt: null, // voided summaries are excluded from the normal history view by default
      ...(params.status && { status: params.status }),
      ...((params.dateFrom || params.dateTo) && {
        date: {
          ...(params.dateFrom && { gte: params.dateFrom }),
          ...(params.dateTo && { lte: params.dateTo }),
        },
      }),
    };

    const [summaries, total] = await this.prisma.$transaction([
      this.prisma.dailySummary.findMany({
        where,
        orderBy: { date: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.dailySummary.count({ where }),
    ]);

    return { summaries, total };
  }

  async findByShopAndDate(shopId: string, date: Date): Promise<DailySummary | null> {
    return this.prisma.dailySummary.findFirst({ where: { shopId, date, voidedAt: null } });
  }

  // Unpaginated — for aggregation callers (ProfitReport), not history views.
  async findFinalizedInRange(
    shopId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<DailySummary[]> {
    return this.prisma.dailySummary.findMany({
      where: {
        shopId,
        voidedAt: null,
        status: "FINALIZED" as DailySummaryStatus,
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: "asc" },
    });
  }

  // Guarded — only a DRAFT can transition to FINALIZED. Prevents a race
  // where two finalize calls both read DRAFT and both "succeed."
  async finalizeIfDraft(id: string, finalizedById: string): Promise<number> {
    const result = await this.prisma.dailySummary.updateMany({
      where: { id, status: "DRAFT" as DailySummaryStatus, voidedAt: null },
      data: { status: "FINALIZED" as DailySummaryStatus, finalizedAt: new Date(), finalizedById },
    });
    return result.count;
  }

  // Guarded on voidedAt IS NULL — a summary (draft or finalized) can be
  // voided exactly once. Voiding a FINALIZED summary is intentional: it's
  // how a wrong close gets corrected, per the "never overwrite, always
  // void + recreate" rule this whole codebase follows for financial rows.
  async voidIfNotVoided(
    id: string,
    data: { voidedById: string; voidReason: string },
  ): Promise<number> {
    const result = await this.prisma.dailySummary.updateMany({
      where: { id, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: data.voidedById, voidReason: data.voidReason },
    });
    return result.count;
  }
}
