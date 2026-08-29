// modules/expense-category/mappers/__tests__/expense-category.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import { toExpenseCategoryResult, toExpenseCategoryResults } from "../expense-category.mapper";

describe("toExpenseCategoryResult", () => {
  it("maps all whitelisted fields", () => {
    const category = buildExpenseCategory();
    expect(toExpenseCategoryResult(category)).toEqual({
      id: category.id,
      shopId: category.shopId,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      createdAt: category.createdAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toExpenseCategoryResult(buildExpenseCategory());
    expect(Object.keys(result).sort()).toEqual(
      ["createdAt", "description", "id", "isActive", "name", "shopId"].sort(),
    );
  });

  it("passes through a null shopId (global category) unchanged", () => {
    const result = toExpenseCategoryResult(buildExpenseCategory({ shopId: null }));
    expect(result.shopId).toBeNull();
  });

  it("passes through a null description unchanged", () => {
    const result = toExpenseCategoryResult(buildExpenseCategory({ description: null }));
    expect(result.description).toBeNull();
  });
});

describe("toExpenseCategoryResults", () => {
  it("maps an array, preserving order", () => {
    const categories = [buildExpenseCategory({ id: "c-1" }), buildExpenseCategory({ id: "c-2" })];
    expect(toExpenseCategoryResults(categories).map((c) => c.id)).toEqual(["c-1", "c-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toExpenseCategoryResults([])).toEqual([]);
  });
});
