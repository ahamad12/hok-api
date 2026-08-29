// modules/expense/mappers/__tests__/expense.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildExpense } from "../../../../test/fixtures/expense.fixture";
import { toExpenseResult, toExpenseResults } from "../expense.mapper";

describe("toExpenseResult", () => {
  it("maps all whitelisted fields, including void fields", () => {
    const expense = buildExpense();
    expect(toExpenseResult(expense)).toEqual({
      id: expense.id,
      shopId: expense.shopId,
      categoryId: expense.categoryId,
      amount: expense.amount,
      description: expense.description,
      billUrl: expense.billUrl,
      expenseDate: expense.expenseDate,
      recordedById: expense.recordedById,
      voidedAt: expense.voidedAt,
      voidedById: expense.voidedById,
      voidReason: expense.voidReason,
      createdAt: expense.createdAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toExpenseResult(buildExpense());
    expect(Object.keys(result).sort()).toEqual(
      [
        "amount",
        "billUrl",
        "categoryId",
        "createdAt",
        "description",
        "expenseDate",
        "id",
        "recordedById",
        "shopId",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });

  it("passes through null void fields on a non-voided expense", () => {
    const result = toExpenseResult(
      buildExpense({ voidedAt: null, voidedById: null, voidReason: null }),
    );
    expect(result.voidedAt).toBeNull();
    expect(result.voidedById).toBeNull();
    expect(result.voidReason).toBeNull();
  });

  it("carries through populated void fields on a voided expense", () => {
    const voidedAt = new Date("2026-02-01");
    const result = toExpenseResult(
      buildExpense({ voidedAt, voidedById: "user-owner-1", voidReason: "Duplicate entry" }),
    );
    expect(result.voidedAt).toEqual(voidedAt);
    expect(result.voidedById).toBe("user-owner-1");
    expect(result.voidReason).toBe("Duplicate entry");
  });

  it("passes through a null billUrl unchanged", () => {
    const result = toExpenseResult(buildExpense({ billUrl: null }));
    expect(result.billUrl).toBeNull();
  });
});

describe("toExpenseResults", () => {
  it("maps an array, preserving order", () => {
    const expenses = [buildExpense({ id: "e-1" }), buildExpense({ id: "e-2" })];
    expect(toExpenseResults(expenses).map((e) => e.id)).toEqual(["e-1", "e-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toExpenseResults([])).toEqual([]);
  });
});
