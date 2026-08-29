// modules/expense-category/__tests__/staff-exclusion.invariant.spec.ts
import { describe, expect, it } from "vitest";
import { AuthorizationError } from "../../../common/errors";
import { buildRequestUser } from "../../../test/fixtures/request-user.fixture";
import { CreateExpenseCategoryUseCase } from "../use-cases/create-expense-category.use-case";
import { GetExpenseCategoriesUseCase } from "../use-cases/get-expense-categories.use-case";
import { UpdateExpenseCategoryUseCase } from "../use-cases/update-expense-category.use-case";

describe("ExpenseCategory module: STAFF is flatly excluded, not shop-scoped", () => {
  const staff = buildRequestUser({ role: "STAFF", shopId: "shop-1" });

  it("CreateExpenseCategoryUseCase rejects STAFF", async () => {
    const useCase = new CreateExpenseCategoryUseCase({} as any, {} as any);
    await expect(useCase.execute(staff, { shopId: "shop-1", name: "X" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("GetExpenseCategoriesUseCase rejects STAFF even for their own shop", async () => {
    const useCase = new GetExpenseCategoriesUseCase({} as any);
    await expect(useCase.execute(staff, { shopId: "shop-1" })).rejects.toThrow(AuthorizationError);
  });

  it("UpdateExpenseCategoryUseCase rejects STAFF", async () => {
    const useCase = new UpdateExpenseCategoryUseCase({} as any);
    await expect(useCase.execute(staff, "cat-1", { name: "X" })).rejects.toThrow(
      AuthorizationError,
    );
  });
});
