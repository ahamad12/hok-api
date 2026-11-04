// apps/server/src/modules/expense/use-cases/create-expense.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExpenseCategoryRepository } from "../../expense-category/repositories/expense-category.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { ExpenseRepository } from "../repositories/expense.repository";

interface CreateExpenseInput {
  shopId: string;
  categoryId: string;
  amount: number;
  description: string;
  billUrl?: string;
  expenseDate: Date;
}

@Injectable()
export class CreateExpenseUseCase {
  constructor(
    private readonly expenseRepo: ExpenseRepository,
    private readonly categoryRepo: ExpenseCategoryRepository,
    private readonly shopRepo: ShopRepository,
  ) {}

  async execute(requester: RequestUser, input: CreateExpenseInput) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can record expenses");
    }
    if (!canAccessShop(requester, input.shopId)) {
      throw new AuthorizationError("Cannot record expenses outside your business");
    }

    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    const category = await this.categoryRepo.findByIdOrThrow(input.categoryId);
    if (!category.isActive) throw new BusinessRuleError("Expense category is not active");

    // A shop-specific category must match this expense's shop; a global
    // category (shopId: null) is valid for any shop's expense.
    if (category.shopId !== null && category.shopId !== input.shopId) {
      throw new BusinessRuleError("Expense category does not belong to this shop");
    }

    return this.expenseRepo.create({
      shopId: input.shopId,
      categoryId: input.categoryId,
      amount: input.amount,
      description: input.description,
      billUrl: input.billUrl ?? null,
      expenseDate: input.expenseDate,
      recordedById: requester.userId,
    });
  }
}
