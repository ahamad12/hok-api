import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseRepository } from "../expense.repository";

describe("ExpenseRepository.bucketAmountsByCategoryEntries", () => {
  let prisma: any;
  let repo: ExpenseRepository;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      expenseCategory: { findMany: vi.fn().mockResolvedValue([]) },
    };
    repo = new ExpenseRepository(prisma);
  });

  it("returns all zeros without querying when entries is empty", async () => {
    const result = await repo.bucketAmountsByCategoryEntries([]);
    expect(result).toEqual({
      purchaseCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    expect(prisma.expenseCategory.findMany).not.toHaveBeenCalled();
  });

  it("fetches distinct categoryIds and selects id+bucket only", async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([{ id: "c-1", bucket: "PURCHASE" }]);
    await repo.bucketAmountsByCategoryEntries([
      { categoryId: "c-1", amountCents: 100 },
      { categoryId: "c-1", amountCents: 50 },
      { categoryId: "c-2", amountCents: 200 },
    ]);
    expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["c-1", "c-2"]) } },
      select: { id: true, bucket: true },
    });
    // distinct: c-1 appears twice but queried once
    const ids = prisma.expenseCategory.findMany.mock.calls[0][0].where.id.in;
    expect(ids).toHaveLength(2);
  });

  it("buckets amounts by the resolved ExpenseBucket, summing per bucket", async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([
      { id: "c-purchase", bucket: "PURCHASE" },
      { id: "c-salary", bucket: "SALARY" },
      { id: "c-rent", bucket: "RENT" },
    ]);
    const result = await repo.bucketAmountsByCategoryEntries([
      { categoryId: "c-purchase", amountCents: 800 },
      { categoryId: "c-salary", amountCents: 1200 },
      { categoryId: "c-purchase", amountCents: 200 },
      { categoryId: "c-rent", amountCents: 600 },
    ]);
    expect(result).toEqual({
      purchaseCost: 1000, // 800+200
      licenseFees: 0,
      salaryExpense: 1200,
      utilityExpense: 0,
      rentExpense: 600,
      otherExpense: 0,
    });
  });

  it("falls back to OTHER for categoryIds not returned by the DB (deleted or unknown)", async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([{ id: "c-1", bucket: "PURCHASE" }]);
    const result = await repo.bucketAmountsByCategoryEntries([
      { categoryId: "c-1", amountCents: 100 },
      { categoryId: "c-unknown", amountCents: 999 },
    ]);
    expect(result.purchaseCost).toBe(100);
    expect(result.otherExpense).toBe(999);
  });

  it("maps each ExpenseBucket to its correct totals key", async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([
      { id: "c-p", bucket: "PURCHASE" },
      { id: "c-l", bucket: "LICENSE" },
      { id: "c-s", bucket: "SALARY" },
      { id: "c-u", bucket: "UTILITY" },
      { id: "c-r", bucket: "RENT" },
      { id: "c-o", bucket: "OTHER" },
    ]);
    const result = await repo.bucketAmountsByCategoryEntries([
      { categoryId: "c-p", amountCents: 10 },
      { categoryId: "c-l", amountCents: 20 },
      { categoryId: "c-s", amountCents: 30 },
      { categoryId: "c-u", amountCents: 40 },
      { categoryId: "c-r", amountCents: 50 },
      { categoryId: "c-o", amountCents: 60 },
    ]);
    expect(result).toEqual({
      purchaseCost: 10,
      licenseFees: 20,
      salaryExpense: 30,
      utilityExpense: 40,
      rentExpense: 50,
      otherExpense: 60,
    });
  });

  it("handles null/undefined bucket values as OTHER via the default branch", async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([{ id: "c-1", bucket: null as any }]);
    const result = await repo.bucketAmountsByCategoryEntries([
      { categoryId: "c-1", amountCents: 123 },
    ]);
    expect(result.otherExpense).toBe(123);
  });
});
