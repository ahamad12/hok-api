// modules/expense/__tests__/staff-exclusion.invariant.spec.ts
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../common/errors";
import { buildRequestUser } from "../../../test/fixtures/request-user.fixture";
import { CreateExpenseUseCase } from "../use-cases/create-expense.use-case";
import { GetExpensesUseCase } from "../use-cases/get-expenses.use-case";
import { VoidExpenseUseCase } from "../use-cases/void-expense.use-case";

// This file exists specifically because Expense deliberately diverges from
// TillEntry/Delivery's "STAFF scoped to own shop" pattern. If any of these
// tests fail, someone changed a use-case to allow STAFF through — that's
// either a deliberate policy reversal (update this file + the module
// comments) or an accidental regression (fix the use-case back).
describe("Expense module: STAFF is flatly excluded, not shop-scoped", () => {
  const staff = buildRequestUser({ role: "STAFF", shopId: "shop-1" });

  it("CreateExpenseUseCase rejects STAFF even for their own shop", async () => {
    const useCase = new CreateExpenseUseCase({} as any, {} as any, {} as any);
    await expect(
      useCase.execute(staff, {
        shopId: "shop-1",
        categoryId: "c1",
        amount: 100,
        description: "x",
        expenseDate: new Date(),
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("GetExpensesUseCase rejects STAFF even querying their own shop", async () => {
    const useCase = new GetExpensesUseCase({} as any);
    await expect(
      useCase.execute(staff, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("VoidExpenseUseCase rejects STAFF even for an expense in their own shop", async () => {
    const useCase = new VoidExpenseUseCase({ findByIdOrThrow: vi.fn() } as any);
    await expect(useCase.execute(staff, "expense-1", "mistake")).rejects.toThrow(
      AuthorizationError,
    );
  });
});
