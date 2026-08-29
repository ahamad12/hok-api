// apps/server/src/modules/expense-category/repositories/expense-category.repository.ts

import { Injectable } from "@nestjs/common";
import { type ExpenseCategory, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { isNotFound, isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class ExpenseCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ExpenseCategory | null> {
    return this.prisma.expenseCategory.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<ExpenseCategory> {
    const category = await this.findById(id);
    if (!category) throw new NotFoundError("ExpenseCategory", id);
    return category;
  }

  // Global (shopId: null) + this shop's categories together — the actual
  // dropdown need, not two separate calls the client has to merge itself.
  async findAllGlobalAndShop(shopId: string, isActive?: boolean): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        OR: [{ shopId: null }, { shopId }],
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: { name: "asc" },
    });
  }

  async create(data: Prisma.ExpenseCategoryUncheckedCreateInput): Promise<ExpenseCategory> {
    try {
      return await this.prisma.expenseCategory.create({ data });
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictError("An expense category with this name already exists");
      throw e;
    }
  }

  async update(
    id: string,
    data: Prisma.ExpenseCategoryUncheckedUpdateInput,
  ): Promise<ExpenseCategory> {
    try {
      return await this.prisma.expenseCategory.update({ where: { id }, data });
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictError("An expense category with this name already exists");
      if (isNotFound(e)) throw new NotFoundError("ExpenseCategory", id);
      throw e;
    }
  }
}
