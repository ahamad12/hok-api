import { describe, expect, it } from "vitest";
import {
  computeExpectedClosingBalance,
  computeVariance,
  type DailySummaryAggregates,
} from "../daily-summary-reconciliation";

function buildAggregates(overrides: Partial<DailySummaryAggregates> = {}): DailySummaryAggregates {
  return {
    openingBalance: 10000,
    closingBalance: 15000,
    totalCashIn: 8000,
    totalCashOut: 2000,
    scratchRevenue: 3000,
    deliveryExpense: 1500,
    otherIncome: 0,
    otherExpense: 2500,
    ...overrides,
  };
}

describe("computeExpectedClosingBalance", () => {
  it("computes opening + cashIn - cashOut + scratch - delivery + otherIncome - otherExpense", () => {
    const a = buildAggregates();
    // 10000 + 8000 - 2000 + 3000 - 1500 + 0 - 2500 = 15000
    expect(computeExpectedClosingBalance(a)).toBe(15000);
  });

  it("handles all-zero aggregates", () => {
    const a = buildAggregates({
      openingBalance: 0,
      closingBalance: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      scratchRevenue: 0,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 0,
    });
    expect(computeExpectedClosingBalance(a)).toBe(0);
  });

  it("handles negative expected balance (cash out exceeds everything else)", () => {
    const a = buildAggregates({
      openingBalance: 0,
      totalCashIn: 0,
      totalCashOut: 5000,
      scratchRevenue: 0,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 0,
    });
    expect(computeExpectedClosingBalance(a)).toBe(-5000);
  });

  it("correctly weights each term's sign — cashOut, deliveryExpense, otherExpense subtract; cashIn, scratchRevenue, otherIncome add", () => {
    const base = buildAggregates({
      openingBalance: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      scratchRevenue: 0,
      deliveryExpense: 0,
      otherIncome: 0,
      otherExpense: 0,
    });
    expect(computeExpectedClosingBalance({ ...base, totalCashIn: 100 })).toBe(100);
    expect(computeExpectedClosingBalance({ ...base, totalCashOut: 100 })).toBe(-100);
    expect(computeExpectedClosingBalance({ ...base, scratchRevenue: 100 })).toBe(100);
    expect(computeExpectedClosingBalance({ ...base, deliveryExpense: 100 })).toBe(-100);
    expect(computeExpectedClosingBalance({ ...base, otherIncome: 100 })).toBe(100);
    expect(computeExpectedClosingBalance({ ...base, otherExpense: 100 })).toBe(-100);
  });
});

describe("computeVariance", () => {
  it("returns 0 when closingBalance exactly matches expected", () => {
    const a = buildAggregates(); // closingBalance: 15000, expected: 15000
    expect(computeVariance(a)).toBe(0);
  });

  it("returns a positive variance ('over') when actual closing exceeds expected", () => {
    const a = buildAggregates({ closingBalance: 15500 }); // expected 15000
    expect(computeVariance(a)).toBe(500);
  });

  it("returns a negative variance ('short') when actual closing is below expected", () => {
    const a = buildAggregates({ closingBalance: 14700 }); // expected 15000
    expect(computeVariance(a)).toBe(-300);
  });
});
