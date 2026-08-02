// modules/category/use-cases/update-category.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import { type CategoryResult, toCategoryResult } from "../mappers/category.mapper";
import { CategoryRepository } from "../repositories/category.repository";

export interface UpdateCategoryInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  categoryId: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: UpdateCategoryInput): Promise<CategoryResult> {
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) throw new NotFoundError("Category", input.categoryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== category.shopId) {
      throw new AuthorizationError("Access denied for this category");
    }

    // isActive:false is deactivation — deliberately non-destructive and
    // non-cascading (see the onDelete: Restrict note in the schema diff).
    // Existing suppliers under a deactivated category keep working; they
    // just won't be offered under an "active categories" picker for new
    // deliveries going forward — that filtering is the UI's job, not this
    // use case's.
    try {
      const updated = await this.categoryRepository.update(category.id, {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      });

      return toCategoryResult(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("A category with this name already exists for this shop");
      }
      throw error;
    }
  }
}
