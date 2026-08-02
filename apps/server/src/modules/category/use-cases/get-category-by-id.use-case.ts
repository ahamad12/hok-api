// modules/category/use-cases/get-category-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type CategoryResult, toCategoryResult } from "../mappers/category.mapper";
import { CategoryRepository } from "../repositories/category.repository";

export interface GetCategoryByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  categoryId: string;
}

@Injectable()
export class GetCategoryByIdUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: GetCategoryByIdInput): Promise<CategoryResult> {
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) throw new NotFoundError("Category", input.categoryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== category.shopId) {
      throw new AuthorizationError("Access denied for this category");
    }
    return toCategoryResult(category);
  }
}
