import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseRepository } from "../expense.repository";

describe("ExpenseRepository.getTotalsByExpenseDate", () => {
  let prisma: any;
  let repo: ExpenseRepository;

  beforeEach(() => {
    prisma = { expense: { groupBy: vi.fn() } };
    repo = new ExpenseRepository(prisma);
  });

  it("groups by categoryId for the exact expenseDate, excluding voided", async () => {
    prisma.expense.groupBy.mockResolvedValue([]);
    const date = new Date("2026-01-15");
    await repo.getTotalsByExpenseDate("shop-1", date);
    expect(prisma.expense.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: { shopId: "shop-1", expenseDate: date, voidedAt: null },
      _sum: { amount: true },
    });
  });

  it("defaults missing sums to 0 per category", async () => {
    prisma.expense.groupBy.mockResolvedValue([{ categoryId: "cat-1", _sum: { amount: null } }]);
    const result = await repo.getTotalsByExpenseDate("shop-1", new Date("2026-01-15"));
    expect(result.byCategory).toEqual([{ categoryId: "cat-1", amountCents: 0 }]);
  });

  it("sums amounts across categories for the grand total", async () => {
    prisma.expense.groupBy.mockResolvedValue([
      { categoryId: "cat-1", _sum: { amount: 1000 } },
      { categoryId: "cat-2", _sum: { amount: 500 } },
    ]);
    const result = await repo.getTotalsByExpenseDate("shop-1", new Date("2026-01-15"));
    expect(result.totalCents).toBe(1500);
  });

  it("returns an empty byCategory and 0 total when there are no expenses that day", async () => {
    prisma.expense.groupBy.mockResolvedValue([]);
    const result = await repo.getTotalsByExpenseDate("shop-1", new Date("2026-01-15"));
    expect(result).toEqual({ totalCents: 0, byCategory: [] });
  });
});
