// apps/server/src/modules/expense-category/use-cases/get-expense-categories.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExpenseCategoryRepository } from "../repositories/expense-category.repository";

@Injectable()
export class GetExpenseCategoriesUseCase {
  constructor(private readonly categoryRepo: ExpenseCategoryRepository) {}

  async execute(requester: RequestUser, query: { shopId: string; isActive?: boolean }) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can view expense categories");
    }
    if (!canAccessShop(requester, query.shopId)) {
      throw new AuthorizationError("Cannot view expense categories outside your business");
    }
    return this.categoryRepo.findAllGlobalAndShop(query.shopId, query.isActive);
  }
}
