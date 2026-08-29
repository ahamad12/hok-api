// test/fixtures/expense.fixture.ts
import type { Expense } from "@tapt-api/db";

export function buildExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",
    shopId: "shop-1",
    categoryId: "expense-category-1",
    amount: 5000,
    description: "Electricity bill",
    billUrl: null,
    expenseDate: new Date("2026-01-15"),
    recordedById: "user-owner-1",
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-15"),
    ...overrides,
  } as Expense;
}
