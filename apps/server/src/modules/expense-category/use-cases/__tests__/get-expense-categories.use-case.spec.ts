// modules/expense-category/use-cases/__tests__/get-expense-categories.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetExpenseCategoriesUseCase } from "../get-expense-categories.use-case";

describe("GetExpenseCategoriesUseCase", () => {
  let categoryRepo: any;
  let useCase: GetExpenseCategoriesUseCase;

  beforeEach(() => {
    categoryRepo = { findAllGlobalAndShop: vi.fn().mockResolvedValue([]) };
    useCase = new GetExpenseCategoriesUseCase(categoryRepo);
  });

  it("throws AuthorizationError for STAFF even querying their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, { shopId: "shop-1" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(useCase.execute(requester, { shopId: "shop-1" })).resolves.toBeDefined();
  });

  it("allows MANAGER for any shop, not just their own", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, { shopId: "shop-1" })).resolves.toBeDefined();
  });

  it("passes shopId and isActive through to the repository", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), {
      shopId: "shop-1",
      isActive: true,
    });
    expect(categoryRepo.findAllGlobalAndShop).toHaveBeenCalledWith("shop-1", true);
  });

  it("returns the categories from the repository", async () => {
    categoryRepo.findAllGlobalAndShop.mockResolvedValue([buildExpenseCategory()]);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1" });
    expect(result).toHaveLength(1);
  });
});
