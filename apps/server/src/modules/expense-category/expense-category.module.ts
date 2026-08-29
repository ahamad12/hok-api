// apps/server/src/modules/expense-category/expense-category.module.ts
import { Module } from "@nestjs/common";
import { ShopModule } from "../shop/shop.module";
import { ExpenseCategoryController } from "./expense-category.controller";
import { ExpenseCategoryRepository } from "./repositories/expense-category.repository";
import { CreateExpenseCategoryUseCase } from "./use-cases/create-expense-category.use-case";
import { GetExpenseCategoriesUseCase } from "./use-cases/get-expense-categories.use-case";
import { UpdateExpenseCategoryUseCase } from "./use-cases/update-expense-category.use-case";

@Module({
  imports: [ShopModule],
  controllers: [ExpenseCategoryController],
  providers: [
    ExpenseCategoryRepository,
    CreateExpenseCategoryUseCase,
    GetExpenseCategoriesUseCase,
    UpdateExpenseCategoryUseCase,
  ],
  exports: [ExpenseCategoryRepository],
})
export class ExpenseCategoryModule {}
