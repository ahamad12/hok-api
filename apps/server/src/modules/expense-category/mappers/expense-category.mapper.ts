// apps/server/src/modules/expense-category/mappers/expense-category.mapper.ts

import type { ExpenseCategory } from "@tapt-api/db";

export type ExpenseCategoryResult = Pick<
  ExpenseCategory,
  "id" | "shopId" | "name" | "description" | "isActive" | "createdAt"
>;

export function toExpenseCategoryResult(category: ExpenseCategory): ExpenseCategoryResult {
  const { id, shopId, name, description, isActive, createdAt } = category;
  return { id, shopId, name, description, isActive, createdAt };
}

export function toExpenseCategoryResults(categories: ExpenseCategory[]): ExpenseCategoryResult[] {
  return categories.map(toExpenseCategoryResult);
}
