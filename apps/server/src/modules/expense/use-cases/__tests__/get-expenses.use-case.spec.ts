// modules/expense/use-cases/__tests__/get-expenses.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetExpensesUseCase } from "../get-expenses.use-case";

describe("GetExpensesUseCase", () => {
  let expenseRepo: any;
  let useCase: GetExpensesUseCase;

  beforeEach(() => {
    expenseRepo = { findAll: vi.fn().mockResolvedValue({ expenses: [], total: 0 }) };
    useCase = new GetExpensesUseCase(expenseRepo);
  });

  it("throws AuthorizationError for STAFF, even querying their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER for any shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("delegates the query as-is to the repository", async () => {
    const query = { shopId: "shop-1", categoryId: "cat-1", limit: 20, offset: 0 };
    await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    expect(expenseRepo.findAll).toHaveBeenCalledWith(query);
  });
});
