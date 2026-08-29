// modules/expense/use-cases/__tests__/void-expense.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildExpense } from "../../../../test/fixtures/expense.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { VoidExpenseUseCase } from "../void-expense.use-case";

describe("VoidExpenseUseCase", () => {
  let expenseRepo: any;
  let useCase: VoidExpenseUseCase;

  beforeEach(() => {
    expenseRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildExpense({ voidedAt: null })),
      voidIfNotVoided: vi.fn().mockResolvedValue(1),
    };
    useCase = new VoidExpenseUseCase(expenseRepo);
  });

  it("throws AuthorizationError for STAFF, even for an expense in their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "expense-1", "Duplicate entry")).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-1", "Duplicate entry"),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER for any shop's expense", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, "expense-1", "Duplicate entry")).resolves.toBeDefined();
  });

  it("throws BusinessRuleError (fast-fail) when the expense is already voided", async () => {
    expenseRepo.findByIdOrThrow.mockResolvedValue(
      buildExpense({ voidedAt: new Date("2026-02-01") }),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-1", "Duplicate entry"),
    ).rejects.toThrow(BusinessRuleError);
    expect(expenseRepo.voidIfNotVoided).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError when voidIfNotVoided reports 0 affected (voided concurrently)", async () => {
    expenseRepo.voidIfNotVoided.mockResolvedValue(0);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-1", "Duplicate entry"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("passes voidedById and voidReason through to the repository", async () => {
    const requester = buildRequestUser({ userId: "user-owner-1", role: "OWNER" });
    await useCase.execute(requester, "expense-1", "Duplicate entry");
    expect(expenseRepo.voidIfNotVoided).toHaveBeenCalledWith("expense-1", {
      voidedById: "user-owner-1",
      voidReason: "Duplicate entry",
    });
  });

  it("re-fetches and returns the voided expense after a successful void", async () => {
    const voided = buildExpense({
      voidedAt: new Date("2026-02-01"),
      voidReason: "Duplicate entry",
    });
    expenseRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildExpense({ voidedAt: null }))
      .mockResolvedValueOnce(voided);
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "expense-1",
      "Duplicate entry",
    );
    expect(result).toEqual(voided);
  });
});
