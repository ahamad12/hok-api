import { describe, expect, it } from "vitest";
import {
  computeProfitReportTotals,
  type ProfitReportExpenseInputs,
  type ProfitReportRevenueInputs,
} from "../profit-report-calculation";

function buildRevenue(
  overrides: Partial<ProfitReportRevenueInputs> = {},
): ProfitReportRevenueInputs {
  return { scratchRevenue: 3000, deliveryRevenue: 0, otherRevenue: 500, ...overrides };
}

function buildExpense(
  overrides: Partial<ProfitReportExpenseInputs> = {},
): ProfitReportExpenseInputs {
  return {
    purchaseCost: 800,
    deliveryCost: 1500,
    licenseFees: 200,
    salaryExpense: 1000,
    utilityExpense: 300,
    rentExpense: 700,
    otherExpense: 100,
    ...overrides,
  };
}

describe("computeProfitReportTotals", () => {
  it("sums revenue buckets into totalRevenue", () => {
    const r = buildRevenue({ scratchRevenue: 1000, deliveryRevenue: 200, otherRevenue: 300 });
    const e = buildExpense({
      purchaseCost: 0,
      deliveryCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    expect(computeProfitReportTotals(r, e).totalRevenue).toBe(1500);
  });

  it("sums all expense buckets into totalExpense", () => {
    const r = buildRevenue({ scratchRevenue: 0, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense();
    // 800+1500+200+1000+300+700+100 = 4600
    expect(computeProfitReportTotals(r, e).totalExpense).toBe(4600);
  });

  it("computes grossProfit as totalRevenue - purchaseCost only", () => {
    const r = buildRevenue({ scratchRevenue: 5000, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense({
      purchaseCost: 800,
      deliveryCost: 9999,
      licenseFees: 9999,
      salaryExpense: 9999,
      utilityExpense: 9999,
      rentExpense: 9999,
      otherExpense: 9999,
    });
    expect(computeProfitReportTotals(r, e).grossProfit).toBe(4200);
  });

  it("computes netProfit as totalRevenue - totalExpense", () => {
    const r = buildRevenue({ scratchRevenue: 5000, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense({
      purchaseCost: 1000,
      deliveryCost: 500,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    // totalRevenue 5000, totalExpense 1500 => net 3500
    expect(computeProfitReportTotals(r, e).netProfit).toBe(3500);
  });

  it("computes profitMargin as net/totalRevenue*100", () => {
    const r = buildRevenue({ scratchRevenue: 10000, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense({
      purchaseCost: 2000,
      deliveryCost: 1000,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    // totalRevenue 10000, totalExpense 3000, net 7000 => 70%
    expect(computeProfitReportTotals(r, e).profitMargin).toBe(70);
  });

  it("returns 0 margin when there is no revenue to divide by", () => {
    const r = buildRevenue({ scratchRevenue: 0, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense();
    expect(computeProfitReportTotals(r, e).profitMargin).toBe(0);
  });

  it("handles all-zero inputs", () => {
    const r = buildRevenue({ scratchRevenue: 0, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense({
      purchaseCost: 0,
      deliveryCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    expect(computeProfitReportTotals(r, e)).toEqual({
      totalRevenue: 0,
      totalExpense: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
    });
  });

  it("handles negative net (loss) correctly — margin goes negative", () => {
    const r = buildRevenue({ scratchRevenue: 1000, deliveryRevenue: 0, otherRevenue: 0 });
    const e = buildExpense({
      purchaseCost: 500,
      deliveryCost: 500,
      licenseFees: 500,
      salaryExpense: 500,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    // revenue 1000, expense 2000 => net -1000 => margin -100%
    const result = computeProfitReportTotals(r, e);
    expect(result.netProfit).toBe(-1000);
    expect(result.profitMargin).toBe(-100);
  });

  it("weights each expense bucket equally in totalExpense — changing any one changes total by same delta", () => {
    const r = buildRevenue({ scratchRevenue: 10000, deliveryRevenue: 0, otherRevenue: 0 });
    const base = buildExpense({
      purchaseCost: 0,
      deliveryCost: 0,
      licenseFees: 0,
      salaryExpense: 0,
      utilityExpense: 0,
      rentExpense: 0,
      otherExpense: 0,
    });
    expect(computeProfitReportTotals(r, { ...base, purchaseCost: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, deliveryCost: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, licenseFees: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, salaryExpense: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, utilityExpense: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, rentExpense: 100 }).totalExpense).toBe(100);
    expect(computeProfitReportTotals(r, { ...base, otherExpense: 100 }).totalExpense).toBe(100);
  });
});
