import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseRepository } from "../expense.repository";

describe("ExpenseRepository.getBucketTotalsByDate", () => {
  let prisma: any;
  let repo: ExpenseRepository;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      expenseCategory: { findMany: vi.fn() },
    };
    repo = new ExpenseRepository(prisma);
  });

  it("queries via $queryRaw joining expenses to expense_categories on bucket, excluding voided", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const date = new Date("2026-01-15");
    await repo.getBucketTotalsByDate("shop-1", date);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // The raw SQL template is an opaque tagged template; assert it was called with shopId/date interpolated.
    // vi.fn captures the raw strings array + interpolations; shopId and date should be among the values.
    const rawCall = prisma.$queryRaw.mock.calls[0];
    // rawCall[0] is TemplateStringsArray, subsequent args are interpolated values
    expect(rawCall).toContain("shop-1");
    expect(rawCall).toContain(date);
  });

  it("maps each returned bucket row into the correct ExpenseBucketTotals key, coercing BigInt totals", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { bucket: "PURCHASE", total: BigInt(800) },
      { bucket: "SALARY", total: BigInt(1200) },
      { bucket: "OTHER", total: BigInt(50) },
    ]);
    const result = await repo.getBucketTotalsByDate("shop-1", new Date("2026-01-15"));
    expect(result).toEqual({
      purchaseCost: 800,
      licenseFees: 0,
      salaryExpense: 1200,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 50,
    });
  });

  it("accumulates multiple rows of the same bucket (defensive, though GROUP BY should collapse)", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { bucket: "RENT", total: BigInt(300) },
      { bucket: "RENT", total: BigInt(200) },
    ]);
    const result = await repo.getBucketTotalsByDate("shop-1", new Date("2026-01-15"));
    expect(result.rentExpense).toBe(500);
  });

  it("maps unknown/future bucket values to otherExpense via the default case", async () => {
    prisma.$queryRaw.mockResolvedValue([{ bucket: "FUTURE_BUCKET" as any, total: BigInt(999) }]);
    const result = await repo.getBucketTotalsByDate("shop-1", new Date("2026-01-15"));
    expect(result.otherExpense).toBe(999);
    expect(result.purchaseCost).toBe(0);
  });

  it("returns all zeros when there are no expenses that day", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await repo.getBucketTotalsByDate("shop-1", new Date("2026-01-15"));
    expect(result).toEqual({
      purchaseCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
  });

  it("handles all six buckets in one call", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { bucket: "PURCHASE", total: BigInt(100) },
      { bucket: "LICENSE", total: BigInt(200) },
      { bucket: "SALARY", total: BigInt(300) },
      { bucket: "UTILITY", total: BigInt(400) },
      { bucket: "RENT", total: BigInt(500) },
      { bucket: "OTHER", total: BigInt(600) },
    ]);
    const result = await repo.getBucketTotalsByDate("shop-1", new Date("2026-01-15"));
    expect(result).toEqual({
      purchaseCost: 100,
      licenseFees: 200,
      salaryExpense: 300,
      utilityExpense: 400,
      rentExpense: 500,
      otherExpense: 600,
    });
  });
});
