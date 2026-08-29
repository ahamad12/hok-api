// modules/expense-category/use-cases/__tests__/create-expense-category.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, ConflictError } from "../../../../common/errors";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateExpenseCategoryUseCase } from "../create-expense-category.use-case";

describe("CreateExpenseCategoryUseCase", () => {
  let categoryRepo: any;
  let shopRepo: any;
  let useCase: CreateExpenseCategoryUseCase;

  beforeEach(() => {
    categoryRepo = { create: vi.fn().mockResolvedValue(buildExpenseCategory()) };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    useCase = new CreateExpenseCategoryUseCase(categoryRepo, shopRepo);
  });

  it("throws AuthorizationError for STAFF", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", name: "Utilities" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER to create a shop-specific category", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", name: "Utilities" }),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER to create a shop-specific category for any shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", name: "Utilities" }),
    ).resolves.toBeDefined();
  });

  it("allows creating a global category (shopId: null) without a shop lookup", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await useCase.execute(requester, { shopId: null, name: "Global Category" });
    expect(shopRepo.findById).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError when the target shop doesn't exist", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1", name: "X" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the target shop is inactive", async () => {
    shopRepo.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1", name: "X" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("passes description through when given, defaults to null when omitted", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1", name: "X" });
    expect(categoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );

    await useCase.execute(buildRequestUser({ role: "OWNER" }), {
      shopId: "shop-1",
      name: "X",
      description: "Details",
    });
    expect(categoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Details" }),
    );
  });

  it("always creates with isActive: true", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1", name: "X" });
    expect(categoryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    categoryRepo.create.mockRejectedValue(
      new ConflictError("An expense category with this name already exists"),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), { shopId: "shop-1", name: "Dup" }),
    ).rejects.toThrow(ConflictError);
  });
});
