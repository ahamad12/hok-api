// apps/server/src/modules/expense/mappers/expense.mapper.ts

import type { Expense } from "@tapt-api/db";

export type ExpenseResult = Pick<
  Expense,
  | "id"
  | "shopId"
  | "categoryId"
  | "amount"
  | "description"
  | "billUrl"
  | "expenseDate"
  | "recordedById"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
>;

export function toExpenseResult(expense: Expense): ExpenseResult {
  const {
    id,
    shopId,
    categoryId,
    amount,
    description,
    billUrl,
    expenseDate,
    recordedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  } = expense;
  return {
    id,
    shopId,
    categoryId,
    amount,
    description,
    billUrl,
    expenseDate,
    recordedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  };
}

export function toExpenseResults(expenses: Expense[]): ExpenseResult[] {
  return expenses.map(toExpenseResult);
}
