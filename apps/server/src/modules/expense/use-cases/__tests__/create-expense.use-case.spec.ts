// modules/expense/use-cases/__tests__/create-expense.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildExpense } from "../../../../test/fixtures/expense.fixture";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateExpenseUseCase } from "../create-expense.use-case";

describe("CreateExpenseUseCase", () => {
  let expenseRepo: any;
  let categoryRepo: any;
  let shopRepo: any;
  let useCase: CreateExpenseUseCase;

  const input = {
    shopId: "shop-1",
    categoryId: "expense-category-1",
    amount: 5000,
    description: "Electricity bill",
    expenseDate: new Date("2026-01-15"),
  };

  beforeEach(() => {
    expenseRepo = { create: vi.fn().mockResolvedValue(buildExpense()) };
    categoryRepo = {
      findByIdOrThrow: vi
        .fn()
        .mockResolvedValue(buildExpenseCategory({ shopId: "shop-1", isActive: true })),
    };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    useCase = new CreateExpenseUseCase(expenseRepo, categoryRepo, shopRepo);
  });

  it("throws AuthorizationError for STAFF, even for their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, input)).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), input),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER for a shop that isn't their own", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, input)).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when the shop doesn't exist", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when the shop is inactive", async () => {
    shopRepo.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when the category is inactive", async () => {
    categoryRepo.findByIdOrThrow.mockResolvedValue(
      buildExpenseCategory({ shopId: "shop-1", isActive: false }),
    );
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when a shop-specific category belongs to a different shop", async () => {
    categoryRepo.findByIdOrThrow.mockResolvedValue(
      buildExpenseCategory({ shopId: "other-shop", isActive: true }),
    );
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("allows a global category (shopId: null) regardless of the expense's shop", async () => {
    categoryRepo.findByIdOrThrow.mockResolvedValue(
      buildExpenseCategory({ shopId: null, isActive: true }),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), input),
    ).resolves.toBeDefined();
  });

  it("defaults billUrl to null when not given", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(expenseRepo.create).toHaveBeenCalledWith(expect.objectContaining({ billUrl: null }));
  });

  it("passes billUrl through when given", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), {
      ...input,
      billUrl: "https://example.com/bill.pdf",
    });
    expect(expenseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ billUrl: "https://example.com/bill.pdf" }),
    );
  });

  it("sets recordedById to the requester's userId", async () => {
    const requester = buildRequestUser({ userId: "user-42", role: "OWNER" });
    await useCase.execute(requester, input);
    expect(expenseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ recordedById: "user-42" }),
    );
  });

  it("returns the created expense", async () => {
    const created = buildExpense({ id: "new-expense" });
    expenseRepo.create.mockResolvedValue(created);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(result).toEqual(created);
  });
});
