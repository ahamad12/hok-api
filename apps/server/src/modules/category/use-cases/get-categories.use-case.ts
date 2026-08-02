// modules/category/use-cases/get-categories.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type CategoryResult, toCategoryResult } from "../mappers/category.mapper";
import { CategoryRepository } from "../repositories/category.repository";

export interface GetCategoriesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  isActive?: boolean;
}

@Injectable()
export class GetCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: GetCategoriesInput): Promise<{ categories: CategoryResult[] }> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }
    const categories = await this.categoryRepository.findAll(input.shopId, input.isActive);
    return { categories: categories.map(toCategoryResult) };
  }
}
