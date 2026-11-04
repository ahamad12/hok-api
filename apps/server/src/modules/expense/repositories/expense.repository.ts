// apps/server/src/modules/expense/repositories/expense.repository.ts

import { Injectable } from "@nestjs/common";
import type { ExpenseBucket } from "@tapt-api/db";
import { type Expense, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { NotFoundError } from "../../../common/errors";

export interface ExpenseBucketTotals {
  purchaseCost: number;
  licenseFees: number;
  salaryExpense: number;
  utilityExpense: number;
  rentExpense: number;
  otherExpense: number;
}

const EMPTY_BUCKETS: ExpenseBucketTotals = {
  purchaseCost: 0,
  licenseFees: 0,
  salaryExpense: 0,
  utilityExpense: 0,
  rentExpense: 0,
  otherExpense: 0,
};

function bucketKey(bucket: ExpenseBucket): keyof ExpenseBucketTotals {
  switch (bucket) {
    case "PURCHASE":
      return "purchaseCost";
    case "LICENSE":
      return "licenseFees";
    case "SALARY":
      return "salaryExpense";
    case "UTILITY":
      return "utilityExpense";
    case "RENT":
      return "rentExpense";
    default:
      return "otherExpense";
  }
}

@Injectable()
export class ExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ExpenseUncheckedCreateInput): Promise<Expense> {
    return this.prisma.expense.create({ data });
  }

  findById(id: string): Promise<Expense | null> {
    return this.prisma.expense.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<Expense> {
    const expense = await this.findById(id);
    if (!expense) throw new NotFoundError("Expense", id);
    return expense;
  }

  async findAll(params: {
    shopId: string;
    categoryId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeVoided?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ expenses: Expense[]; total: number }> {
    const where: Prisma.ExpenseWhereInput = {
      shopId: params.shopId,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(!params.includeVoided && { voidedAt: null }),
      ...((params.dateFrom || params.dateTo) && {
        expenseDate: {
          ...(params.dateFrom && { gte: params.dateFrom }),
          ...(params.dateTo && { lte: params.dateTo }),
        },
      }),
    };

    const [expenses, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { expenses, total };
  }

  async getTotalsByExpenseDate(
    shopId: string,
    date: Date,
  ): Promise<{ totalCents: number; byCategory: { categoryId: string; amountCents: number }[] }> {
    const rows = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: { shopId, expenseDate: date, voidedAt: null },
      _sum: { amount: true },
    });

    const byCategory = rows.map((r) => ({
      categoryId: r.categoryId,
      amountCents: r._sum.amount ?? 0,
    }));
    return { totalCents: byCategory.reduce((sum, c) => sum + c.amountCents, 0), byCategory };
  }

  // Raw gap-fallback path — single date, joined on the real bucket enum.
  // Used only for dates with no FINALIZED DailySummary.
  async getBucketTotalsByDate(shopId: string, date: Date): Promise<ExpenseBucketTotals> {
    const rows = await this.prisma.$queryRaw<{ bucket: ExpenseBucket; total: bigint }[]>`
      SELECT ec."bucket" as bucket, COALESCE(SUM(e."amount"), 0) as total
      FROM "expenses" e
      JOIN "expense_categories" ec ON ec."id" = e."category_id"
      WHERE e."shop_id" = ${shopId}
        AND e."voided_at" IS NULL
        AND e."expense_date" = ${date}
      GROUP BY ec."bucket"
    `;
    const buckets = { ...EMPTY_BUCKETS };
    for (const row of rows) {
      buckets[bucketKey(row.bucket)] += Number(row.total);
    }
    return buckets;
  }

  // DailySummary-covered dates — buckets breakdown.expenseByCategory
  // ({categoryId, amountCents}[]) through the real bucket enum instead of
  // dumping everything into otherExpense.
  async bucketAmountsByCategoryEntries(
    entries: { categoryId: string; amountCents: number }[],
  ): Promise<ExpenseBucketTotals> {
    if (entries.length === 0) return { ...EMPTY_BUCKETS };

    const categoryIds = [...new Set(entries.map((e) => e.categoryId))];
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, bucket: true },
    });
    const bucketById = new Map(categories.map((c) => [c.id, c.bucket]));

    const buckets = { ...EMPTY_BUCKETS };
    for (const entry of entries) {
      const bucket = bucketById.get(entry.categoryId) ?? "OTHER";
      buckets[bucketKey(bucket)] += entry.amountCents;
    }
    return buckets;
  }

  // Guarded on voidedAt IS NULL — voiding twice is a safe 0-affected no-op,
  // never a double-void that overwrites the original voidReason/voidedById.
  async voidIfNotVoided(
    id: string,
    data: { voidedById: string; voidReason: string },
  ): Promise<number> {
    const result = await this.prisma.expense.updateMany({
      where: { id, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: data.voidedById, voidReason: data.voidReason },
    });
    return result.count;
  }
}
