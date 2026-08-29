// apps/server/src/modules/expense/expense.controller.ts
import { Controller } from "@nestjs/common";
import { expenseContract } from "@tapt-api/api/contracts/expense.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
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
    return tsRestHandler(expenseContract.create, async ({ body }) => {
      const expense = await this.createExpenseUseCase.execute(user, body);
      return { status: 201, body: toExpenseResult(expense) };
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return tsRestHandler(expenseContract.getAll, async ({ query }) => {
      const { expenses, total } = await this.getExpensesUseCase.execute(user, query);
      return { status: 200, body: { expenses: toExpenseResults(expenses), total } };
    });
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(expenseContract.void)
  voidExpense(@CurrentUser() user: RequestUser) {
    return tsRestHandler(expenseContract.void, async ({ params, body }) => {
      const expense = await this.voidExpenseUseCase.execute(user, params.id, body.voidReason);
      return { status: 200, body: toExpenseResult(expense) };
    });
  }
}
