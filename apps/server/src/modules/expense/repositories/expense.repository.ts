// apps/server/src/modules/expense/repositories/expense.repository.ts

import { Injectable } from "@nestjs/common";
import { type Expense, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { NotFoundError } from "../../../common/errors";

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
