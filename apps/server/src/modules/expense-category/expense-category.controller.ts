// apps/server/src/modules/expense-category/expense-category.controller.ts
import { Controller } from "@nestjs/common";
import { expenseCategoryContract } from "@tapt-api/api/contracts/expense-category.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  toExpenseCategoryResult,
  toExpenseCategoryResults,
} from "./mappers/expense-category.mapper";
import { CreateExpenseCategoryUseCase } from "./use-cases/create-expense-category.use-case";
import { GetExpenseCategoriesUseCase } from "./use-cases/get-expense-categories.use-case";
import { UpdateExpenseCategoryUseCase } from "./use-cases/update-expense-category.use-case";

@Controller()
export class ExpenseCategoryController {
  constructor(
    private readonly createExpenseCategoryUseCase: CreateExpenseCategoryUseCase,
    private readonly getExpenseCategoriesUseCase: GetExpenseCategoriesUseCase,
    private readonly updateExpenseCategoryUseCase: UpdateExpenseCategoryUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseCategoryContract.create)
  create(@CurrentUser() user: RequestUser) {
    return tsRestHandler(expenseCategoryContract.create, async ({ body }) => {
      const category = await this.createExpenseCategoryUseCase.execute(user, body);
      return { status: 201, body: toExpenseCategoryResult(category) };
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseCategoryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return tsRestHandler(expenseCategoryContract.getAll, async ({ query }) => {
      const categories = await this.getExpenseCategoriesUseCase.execute(user, query);
      return { status: 200, body: { categories: toExpenseCategoryResults(categories) } };
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseCategoryContract.update)
  update(@CurrentUser() user: RequestUser) {
    return tsRestHandler(expenseCategoryContract.update, async ({ params, body }) => {
      const category = await this.updateExpenseCategoryUseCase.execute(user, params.id, body);
      return { status: 200, body: toExpenseCategoryResult(category) };
    });
  }
}
