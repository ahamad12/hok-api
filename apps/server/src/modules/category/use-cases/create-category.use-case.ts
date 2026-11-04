// modules/category/use-cases/create-category.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type CategoryResult, toCategoryResult } from "../mappers/category.mapper";
import { CategoryRepository } from "../repositories/category.repository";

export interface CreateCategoryInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  name: string;
  description?: string;
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CategoryResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("You can only create categories for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const category = await this.categoryRepository.create({
      shopId: input.shopId,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
    });

    return toCategoryResult(category);
  }
}
