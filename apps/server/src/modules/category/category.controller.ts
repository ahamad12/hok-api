// modules/category/category.controller.ts
import { Controller } from "@nestjs/common";
import { categoryContract } from "@tapt-api/api/contracts/category.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type CreateCategoryInput,
  CreateCategoryUseCase,
} from "./use-cases/create-category.use-case";
import { type GetCategoriesInput, GetCategoriesUseCase } from "./use-cases/get-categories.use-case";
import { GetCategoryByIdUseCase } from "./use-cases/get-category-by-id.use-case";
import {
  type UpdateCategoryInput,
  UpdateCategoryUseCase,
} from "./use-cases/update-category.use-case";

@Controller()
export class CategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly getCategoryByIdUseCase: GetCategoryByIdUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(categoryContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateCategoryInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createCategoryUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(categoryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetCategoriesInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getCategoriesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(categoryContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getCategoryByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        categoryId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(categoryContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<UpdateCategoryInput, "requesterRole" | "requesterShopId" | "categoryId">;
    }) => {
      const result = await this.updateCategoryUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        categoryId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }
}
