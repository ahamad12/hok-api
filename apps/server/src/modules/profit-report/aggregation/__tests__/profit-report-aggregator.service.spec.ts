import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { ProfitReportAggregatorService } from "../profit-report-aggregator.service";

describe("ProfitReportAggregatorService", () => {
  let summaryRepo: any;
  let scratchRepo: any;
  let packRepo: any;
  let deliveryRepo: any;
  let expenseRepo: any;
  let service: ProfitReportAggregatorService;

  const periodStart = new Date("2026-01-15");
  const periodEnd = new Date("2026-01-17");

  beforeEach(() => {
    summaryRepo = { findFinalizedInRange: vi.fn().mockResolvedValue([]) };
    scratchRepo = { getSummaryByGame: vi.fn().mockResolvedValue([]) };
    packRepo = { getInventoryValue: vi.fn().mockResolvedValue(0) };
    deliveryRepo = {
      getTotalsByDeliveredAtDate: vi
        .fn()
        .mockResolvedValue({ totalAmountCents: 0, bySupplier: [] }),
    };
    expenseRepo = {
      getBucketTotalsByDate: vi.fn().mockResolvedValue({
        purchaseCost: 0,
        licenseFees: 0,
        salaryExpense: 0,
        utilityExpense: 0,
        rentExpense: 0,
        otherExpense: 0,
      }),
      bucketAmountsByCategoryEntries: vi.fn().mockResolvedValue({
        purchaseCost: 0,
        licenseFees: 0,
        salaryExpense: 0,
        utilityExpense: 0,
        rentExpense: 0,
        otherExpense: 0,
      }),
    };
    service = new ProfitReportAggregatorService(
      summaryRepo,
      scratchRepo,
      packRepo,
      deliveryRepo,
      expenseRepo,
    );
  });

  it("returns all zeros and marks every date uncovered when there are no finalized summaries", async () => {
    const result = await service.aggregate("shop-1", periodStart, periodEnd);
    expect(result.scratchRevenue).toBe(0);
    expect(result.deliveryRevenue).toBe(0);
    expect(result.otherRevenue).toBe(0);
    expect(result.deliveryCost).toBe(0);
    expect(result.scratchCardsCount).toBe(0);
    expect(result.inventoryValue).toBe(0);
    expect(result.uncoveredDates).toEqual(["2026-01-15", "2026-01-16", "2026-01-17"]);
    expect(expenseRepo.getBucketTotalsByDate).toHaveBeenCalledTimes(3);
    expect(scratchRepo.getSummaryByGame).toHaveBeenCalledTimes(3);
  });

  it("prefers DailySummary cache — does not call raw tables when every date is covered", async () => {
    const summaries = [
      buildDailySummary({
        date: new Date("2026-01-15"),
        scratchRevenue: 3000,
        deliveryExpense: 1500,
        otherIncome: 200,
        otherExpense: 500,
      }),
      buildDailySummary({
        date: new Date("2026-01-16"),
        scratchRevenue: 1000,
        deliveryExpense: 400,
        otherIncome: 0,
        otherExpense: 0,
      }),
      buildDailySummary({
        date: new Date("2026-01-17"),
        scratchRevenue: 500,
        deliveryExpense: 0,
        otherIncome: 0,
        otherExpense: 0,
      }),
    ];
    summaryRepo.findFinalizedInRange.mockResolvedValue(summaries);
    expenseRepo.bucketAmountsByCategoryEntries.mockResolvedValue({
      purchaseCost: 100,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 50,
    });
    const result = await service.aggregate("shop-1", periodStart, periodEnd);
    expect(result.uncoveredDates).toEqual([]);
    expect(scratchRepo.getSummaryByGame).not.toHaveBeenCalled();
    expect(deliveryRepo.getTotalsByDeliveredAtDate).not.toHaveBeenCalled();
    expect(expenseRepo.getBucketTotalsByDate).not.toHaveBeenCalled();
    // scratchRevenue sum from summaries
    expect(result.scratchRevenue).toBe(4500);
    expect(result.deliveryCost).toBe(1900);
    expect(result.otherRevenue).toBe(200);
  });

  it("buckets expenseByCategory entries through the real bucket enum", async () => {
    const summary = buildDailySummary({
      date: new Date("2026-01-15"),
      scratchRevenue: 0,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 0,
      breakdown: {
        tillByCategory: {},
        scratchByGame: [],
        deliveryBySupplier: [],
        expenseByCategory: [{ categoryId: "c-purchase", amountCents: 800 }],
      },
    });
    summaryRepo.findFinalizedInRange.mockResolvedValue([summary]);
    expenseRepo.bucketAmountsByCategoryEntries.mockResolvedValue({
      purchaseCost: 800,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    const result = await service.aggregate(
      "shop-1",
      new Date("2026-01-15"),
      new Date("2026-01-15"),
    );
    expect(expenseRepo.bucketAmountsByCategoryEntries).toHaveBeenCalledWith([
      { categoryId: "c-purchase", amountCents: 800 },
    ]);
    expect(result.expenseBuckets.purchaseCost).toBe(800);
    expect(result.expenseBuckets.otherExpense).toBe(0);
  });

  it("falls back to otherExpense when a day has no expenseByCategory breakdown", async () => {
    const summary = buildDailySummary({
      date: new Date("2026-01-15"),
      scratchRevenue: 0,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 2500,
      breakdown: {
        tillByCategory: {},
        scratchByGame: [],
        deliveryBySupplier: [],
        expenseByCategory: [],
      },
    });
    summaryRepo.findFinalizedInRange.mockResolvedValue([summary]);
    const result = await service.aggregate(
      "shop-1",
      new Date("2026-01-15"),
      new Date("2026-01-15"),
    );
    // Flattened: still calls bucketAmountsByCategoryEntries with [] for the period, then adds fallback
    expect(expenseRepo.bucketAmountsByCategoryEntries).toHaveBeenCalledWith([]);
    expect(result.expenseBuckets.otherExpense).toBe(2500);
  });

  it("sums scratchCardsCount from breakdown.scratchByGame ticketsSold", async () => {
    const summary = buildDailySummary({
      date: new Date("2026-01-15"),
      scratchRevenue: 3000,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 0,
      breakdown: {
        tillByCategory: {},
        scratchByGame: [
          { gameId: "g-1", ticketsSold: 5, revenueCents: 1000 },
          { gameId: "g-2", ticketsSold: 3, revenueCents: 600 },
        ],
        deliveryBySupplier: [],
        expenseByCategory: [],
      },
    });
    summaryRepo.findFinalizedInRange.mockResolvedValue([summary]);
    const result = await service.aggregate(
      "shop-1",
      new Date("2026-01-15"),
      new Date("2026-01-15"),
    );
    expect(result.scratchCardsCount).toBe(8);
    expect(result.scratchRevenue).toBe(3000);
  });

  it("merges DailySummary-covered dates with gap-fallback dates", async () => {
    // 15th covered, 16th uncovered
    const summary = buildDailySummary({
      date: new Date("2026-01-15"),
      scratchRevenue: 2000,
      deliveryExpense: 300,
      otherIncome: 0,
      otherExpense: 0,
      breakdown: {
        tillByCategory: {},
        scratchByGame: [{ gameId: "g-1", ticketsSold: 4, revenueCents: 2000 }],
        deliveryBySupplier: [],
        expenseByCategory: [],
      },
    });
    summaryRepo.findFinalizedInRange.mockResolvedValue([summary]);
    expenseRepo.bucketAmountsByCategoryEntries.mockResolvedValue({
      purchaseCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    scratchRepo.getSummaryByGame.mockResolvedValue([
      { gameId: "g-2", ticketsSold: 2, revenueCents: 800 },
    ]);
    deliveryRepo.getTotalsByDeliveredAtDate.mockResolvedValue({
      totalAmountCents: 400,
      bySupplier: [],
    });
    expenseRepo.getBucketTotalsByDate.mockResolvedValue({
      purchaseCost: 50,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 10,
    });

    const result = await service.aggregate(
      "shop-1",
      new Date("2026-01-15"),
      new Date("2026-01-16"),
    );
    expect(result.uncoveredDates).toEqual(["2026-01-16"]);
    expect(result.scratchRevenue).toBe(2800); // 2000 + 800
    expect(result.scratchCardsCount).toBe(6); // 4 + 2
    expect(result.deliveryCost).toBe(700); // 300 + 400
    expect(result.expenseBuckets.purchaseCost).toBe(50);
    expect(result.expenseBuckets.otherExpense).toBe(10);
  });

  it("always returns deliveryRevenue 0 and inventoryValue 0 (no schema source)", async () => {
    const result = await service.aggregate("shop-1", periodStart, periodEnd);
    expect(result.deliveryRevenue).toBe(0);
    expect(result.inventoryValue).toBe(0);
  });

  it("queries findFinalizedInRange with the exact period bounds", async () => {
    await service.aggregate("shop-1", periodStart, periodEnd);
    expect(summaryRepo.findFinalizedInRange).toHaveBeenCalledWith("shop-1", periodStart, periodEnd);
  });

  it("passes each uncovered date as a UTC midnight Date to the gap repositories", async () => {
    summaryRepo.findFinalizedInRange.mockResolvedValue([]);
    await service.aggregate("shop-1", new Date("2026-01-15"), new Date("2026-01-16"));
    expect(scratchRepo.getSummaryByGame).toHaveBeenCalledWith(
      "shop-1",
      new Date("2026-01-15"),
      new Date("2026-01-15"),
    );
    expect(scratchRepo.getSummaryByGame).toHaveBeenCalledWith(
      "shop-1",
      new Date("2026-01-16"),
      new Date("2026-01-16"),
    );
    expect(deliveryRepo.getTotalsByDeliveredAtDate).toHaveBeenCalledWith(
      "shop-1",
      new Date("2026-01-15"),
    );
    expect(expenseRepo.getBucketTotalsByDate).toHaveBeenCalledWith(
      "shop-1",
      new Date("2026-01-15"),
    );
  });
});
