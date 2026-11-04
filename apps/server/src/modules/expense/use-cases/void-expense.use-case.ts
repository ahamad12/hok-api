// apps/server/src/modules/expense/use-cases/void-expense.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExpenseRepository } from "../repositories/expense.repository";

@Injectable()
export class VoidExpenseUseCase {
  constructor(private readonly expenseRepo: ExpenseRepository) {}

  async execute(requester: RequestUser, expenseId: string, voidReason: string) {
    // Flat exclusion, matching void-task's "sensitive workflow" precedent
    // rather than void-delivery's shop-scoped precedent — consistent with
    // every other use-case in this module (see get-expenses.use-case.ts
    // for the same note). A role that can't view expenses can't void them.
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can void expenses");
    }

    const expense = await this.expenseRepo.findByIdOrThrow(expenseId);
    if (!canAccessShop(requester, expense.shopId)) {
      throw new AuthorizationError("Cannot void expenses outside your business");
    }
    if (expense.voidedAt) throw new BusinessRuleError("Expense is already voided");

    const affected = await this.expenseRepo.voidIfNotVoided(expenseId, {
      voidedById: requester.userId,
      voidReason,
    });
    if (affected === 0) {
      throw new BusinessRuleError("Expense is already voided");
    }

    return this.expenseRepo.findByIdOrThrow(expenseId);
  }
}
