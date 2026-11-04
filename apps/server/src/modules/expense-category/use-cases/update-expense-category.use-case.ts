// apps/server/src/modules/expense-category/use-cases/update-expense-category.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExpenseCategoryRepository } from "../repositories/expense-category.repository";

interface UpdateExpenseCategoryInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateExpenseCategoryUseCase {
  constructor(private readonly categoryRepo: ExpenseCategoryRepository) {}

  async execute(requester: RequestUser, categoryId: string, input: UpdateExpenseCategoryInput) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can manage expense categories");
    }

    // 404 before attempting the write, so a missing category never surfaces
    // as a generic Prisma not-found from the update call itself.
    const category = await this.categoryRepo.findByIdOrThrow(categoryId);
    // Shared (shop-less) categories belong to every tenant: system-managed.
    if (category.shopId === null) {
      throw new AuthorizationError("Shared expense categories can't be edited");
    }
    if (!canAccessShop(requester, category.shopId)) {
      throw new AuthorizationError("Cannot manage expense categories outside your business");
    }

    // isActive:false is non-cascading — existing Expense rows referencing
    // this category are untouched and remain queryable; the check only
    // gates new expense creation (see create-expense.use-case.ts).
    return this.categoryRepo.update(categoryId, {
      name: input.name,
      description: input.description,
      isActive: input.isActive,
    });
  }
}
