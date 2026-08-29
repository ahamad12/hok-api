// apps/server/src/modules/expense/expense.module.ts
import { Module } from "@nestjs/common";
import { ExpenseCategoryModule } from "../expense-category/expense-category.module";
import { ShopModule } from "../shop/shop.module";
import { ExpenseController } from "./expense.controller";
import { ExpenseRepository } from "./repositories/expense.repository";
import { CreateExpenseUseCase } from "./use-cases/create-expense.use-case";
import { GetExpensesUseCase } from "./use-cases/get-expenses.use-case";
import { VoidExpenseUseCase } from "./use-cases/void-expense.use-case";

@Module({
  imports: [ShopModule, ExpenseCategoryModule],
  controllers: [ExpenseController],
  providers: [ExpenseRepository, CreateExpenseUseCase, GetExpensesUseCase, VoidExpenseUseCase],
  exports: [ExpenseRepository],
})
export class ExpenseModule {}
