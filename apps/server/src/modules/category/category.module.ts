// modules/category/category.module.ts
import { Module } from "@nestjs/common";
import { ShopModule } from "../shop/shop.module";
import { CategoryController } from "./category.controller";
import { CategoryRepository } from "./repositories/category.repository";
import { CreateCategoryUseCase } from "./use-cases/create-category.use-case";
import { GetCategoriesUseCase } from "./use-cases/get-categories.use-case";
import { GetCategoryByIdUseCase } from "./use-cases/get-category-by-id.use-case";
import { UpdateCategoryUseCase } from "./use-cases/update-category.use-case";

@Module({
  imports: [ShopModule],
  controllers: [CategoryController],
  providers: [
    CategoryRepository,
    CreateCategoryUseCase,
    GetCategoriesUseCase,
    GetCategoryByIdUseCase,
    UpdateCategoryUseCase,
  ],
  exports: [CategoryRepository],
})
export class CategoryModule {}
