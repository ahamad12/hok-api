// apps/server/src/modules/expense-category/expense-category.controller.ts
import { Controller } from "@nestjs/common";
import { expenseCategoryContract } from "@tapt-api/api/contracts/expense-category.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { UseCaseArg } from "../../common/types/use-case-arg.type";
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
    return async ({ body }: { body: UseCaseArg<CreateExpenseCategoryUseCase, 1> }) => {
      const category = await this.createExpenseCategoryUseCase.execute(user, body);
      return { status: 201 as const, body: toExpenseCategoryResult(category) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseCategoryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: UseCaseArg<GetExpenseCategoriesUseCase, 1> }) => {
      const categories = await this.getExpenseCategoriesUseCase.execute(user, query);
      return { status: 200 as const, body: { categories: toExpenseCategoryResults(categories) } };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseCategoryContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: UseCaseArg<UpdateExpenseCategoryUseCase, 2>;
    }) => {
      const category = await this.updateExpenseCategoryUseCase.execute(user, params.id, body);
      return { status: 200 as const, body: toExpenseCategoryResult(category) };
    };
  }
}
