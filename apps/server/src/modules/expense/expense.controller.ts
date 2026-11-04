// apps/server/src/modules/expense/expense.controller.ts
import { Controller } from "@nestjs/common";
import { expenseContract } from "@tapt-api/api/contracts/expense.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { UseCaseArg } from "../../common/types/use-case-arg.type";
import { toExpenseResult, toExpenseResults } from "./mappers/expense.mapper";
import { CreateExpenseUseCase } from "./use-cases/create-expense.use-case";
import { GetExpensesUseCase } from "./use-cases/get-expenses.use-case";
import { VoidExpenseUseCase } from "./use-cases/void-expense.use-case";

@Controller()
export class ExpenseController {
  constructor(
    private readonly createExpenseUseCase: CreateExpenseUseCase,
    private readonly getExpensesUseCase: GetExpensesUseCase,
    private readonly voidExpenseUseCase: VoidExpenseUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({ body }: { body: UseCaseArg<CreateExpenseUseCase, 1> }) => {
      const expense = await this.createExpenseUseCase.execute(user, body);
      return { status: 201 as const, body: toExpenseResult(expense) };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: UseCaseArg<GetExpensesUseCase, 1> }) => {
      const { expenses, total } = await this.getExpensesUseCase.execute(user, query);
      return { status: 200 as const, body: { expenses: toExpenseResults(expenses), total } };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseContract.void)
  voidExpense(@CurrentUser() user: RequestUser) {
    return async ({ params, body }: { params: { id: string }; body: { voidReason: string } }) => {
      const expense = await this.voidExpenseUseCase.execute(user, params.id, body.voidReason);
      return { status: 200 as const, body: toExpenseResult(expense) };
    };
  }
}
