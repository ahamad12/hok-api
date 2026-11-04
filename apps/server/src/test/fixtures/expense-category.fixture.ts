// test/fixtures/expense-category.fixture.ts
import type { ExpenseCategory } from "@tapt-api/db";

export function buildExpenseCategory(overrides: Partial<ExpenseCategory> = {}): ExpenseCategory {
  return {
    id: "expense-category-1",
    shopId: "shop-1",
    name: "Utilities",
    description: null,
    bucket: "OTHER",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as unknown as ExpenseCategory;
}
