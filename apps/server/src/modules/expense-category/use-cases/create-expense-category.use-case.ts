// apps/server/src/modules/expense-category/use-cases/create-expense-category.use-case.ts

import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { ExpenseCategoryRepository } from "../repositories/expense-category.repository";

interface CreateExpenseCategoryInput {
  shopId: string | null; // null = global, visible to every shop
  name: string;
  description?: string;
}

@Injectable()
export class CreateExpenseCategoryUseCase {
  constructor(
    private readonly categoryRepo: ExpenseCategoryRepository,
    private readonly shopRepo: ShopRepository,
  ) {}

  async execute(requester: RequestUser, input: CreateExpenseCategoryInput) {
    // Flat exclusion — STAFF never reaches this module, no shop-scoping to check.
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can manage expense categories");
    }

    // Categories without a shop are shared by every tenant, so only the
    // system (seed data) may create them. A tenant's category belongs to
    // one of its shops.
    if (!input.shopId) {
      throw new BusinessRuleError("Choose a shop for this category");
    }
    if (!canAccessShop(requester, input.shopId)) {
      throw new AuthorizationError("Cannot manage expense categories outside your business");
    }
    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    const category = await this.categoryRepo.create({
      shopId: input.shopId,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
    });

    return category;
  }
}
