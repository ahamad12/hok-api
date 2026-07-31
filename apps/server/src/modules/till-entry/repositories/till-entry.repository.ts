import { Injectable } from "@nestjs/common";
import { PrismaService, type TillEntry, type TillEntryCategory } from "@tapt-api/db"; // value import — required for Nest DI, `import type` breaks bootstrap
import type { Prisma } from "@tapt-api/db/prisma";

export interface TillEntryFilters {
  shopId: string;
  category?: TillEntryCategory;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class TillEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<TillEntry | null> {
    return this.prisma.tillEntry.findUnique({ where: { id } });
  }

  /** Whether the given entry already has a reversal pointing at it — used
   *  to reject reversing the same mistake twice. Application-level guard;
   *  the DB enforces it atomically via @@unique([reversesEntryId]). */
  findReversalFor(entryId: string): Promise<TillEntry | null> {
    return this.prisma.tillEntry.findFirst({ where: { reversesEntryId: entryId } });
  }

  async findAll(
    filters: TillEntryFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ entries: TillEntry[]; total: number }> {
    const where: Prisma.TillEntryWhereInput = { shopId: filters.shopId };
    if (filters.category) where.category = filters.category;
    if (filters.dateFrom || filters.dateTo) {
      where.transactionDate = {};
      if (filters.dateFrom) where.transactionDate.gte = filters.dateFrom;
      if (filters.dateTo) where.transactionDate.lte = filters.dateTo;
    }

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.tillEntry.findMany({
        where,
        orderBy: { transactionDate: "desc" },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.tillEntry.count({ where }),
    ]);

    return { entries, total };
  }

  create(data: Prisma.TillEntryUncheckedCreateInput): Promise<TillEntry> {
    return this.prisma.tillEntry.create({ data });
  }

  /**
   * DELIBERATELY includes reversal rows in the sum — no filter on
   * reversesEntryId here. A reversal carries the same category as the
   * entry it corrects with a NEGATED amount (see ReverseTillEntryUseCase),
   * so summing it alongside the original is what makes a correction net
   * to zero. Filtering reversal rows OUT of this sum (as an earlier draft
   * of this plan proposed) would mean a correction has no effect on any
   * reported total — the mistake stays fully counted regardless.
   */
  async getCategoryTotals(
    shopId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Array<{ category: string; totalAmount: number }>> {
    const result = await this.prisma.tillEntry.groupBy({
      by: ["category"],
      where: { shopId, transactionDate: { gte: dateFrom, lte: dateTo } },
      _sum: { amount: true },
    });
    return result.map((r) => ({ category: r.category, totalAmount: r._sum.amount ?? 0 }));
  }

  async getCategoryTotalsBefore(
    shopId: string,
    date: Date,
  ): Promise<Array<{ category: string; totalAmount: number }>> {
    const result = await this.prisma.tillEntry.groupBy({
      by: ["category"],
      where: { shopId, transactionDate: { lt: date } },
      _sum: { amount: true },
    });
    return result.map((r) => ({ category: r.category, totalAmount: r._sum.amount ?? 0 }));
  }
}
