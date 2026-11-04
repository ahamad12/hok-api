import { describe, expect, it } from "vitest";
import { buildProfitReport } from "../../../../test/fixtures/profit-report.fixture";
import { toProfitReportResult, toProfitReportResults } from "../profit-report.mapper";

describe("toProfitReportResult", () => {
  it("maps all whitelisted fields", () => {
    const report = buildProfitReport();
    expect(toProfitReportResult(report)).toEqual({
      id: report.id,
      shopId: report.shopId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      scratchRevenue: report.scratchRevenue,
      deliveryRevenue: report.deliveryRevenue,
      otherRevenue: report.otherRevenue,
      totalRevenue: report.totalRevenue,
      purchaseCost: report.purchaseCost,
      deliveryCost: report.deliveryCost,
      licenseFees: report.licenseFees,
      salaryExpense: report.salaryExpense,
      utilityExpense: report.utilityExpense,
      rentExpense: report.rentExpense,
      otherExpense: report.otherExpense,
      totalExpense: report.totalExpense,
      grossProfit: report.grossProfit,
      netProfit: report.netProfit,
      profitMargin: report.profitMargin,
      scratchCardsCount: report.scratchCardsCount,
      inventoryValue: report.inventoryValue,
      generatedAt: report.generatedAt,
      generatedById: report.generatedById,
      voidedAt: report.voidedAt,
      voidedById: report.voidedById,
      voidReason: report.voidReason,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toProfitReportResult(buildProfitReport());
    expect(Object.keys(result).sort()).toEqual(
      [
        "deliveryCost",
        "deliveryRevenue",
        "generatedAt",
        "generatedById",
        "grossProfit",
        "id",
        "inventoryValue",
        "licenseFees",
        "netProfit",
        "otherExpense",
        "otherRevenue",
        "periodEnd",
        "periodStart",
        "profitMargin",
        "purchaseCost",
        "rentExpense",
        "salaryExpense",
        "scratchCardsCount",
        "scratchRevenue",
        "shopId",
        "totalExpense",
        "totalRevenue",
        "utilityExpense",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });

  it("passes through null void fields on a live report", () => {
    const result = toProfitReportResult(
      buildProfitReport({ voidedAt: null, voidedById: null, voidReason: null }),
    );
    expect(result.voidedAt).toBeNull();
    expect(result.voidedById).toBeNull();
    expect(result.voidReason).toBeNull();
  });

  it("carries through populated void fields", () => {
    const voidedAt = new Date("2026-02-02");
    const result = toProfitReportResult(
      buildProfitReport({ voidedAt, voidedById: "user-owner-2", voidReason: "Duplicate period" }),
    );
    expect(result.voidedAt).toEqual(voidedAt);
    expect(result.voidedById).toBe("user-owner-2");
    expect(result.voidReason).toBe("Duplicate period");
  });

  it("preserves profit numbers exactly, including zero and negative margin", () => {
    const result = toProfitReportResult(
      buildProfitReport({
        netProfit: -500,
        profitMargin: -12.5,
        deliveryRevenue: 0,
        inventoryValue: 0,
      }),
    );
    expect(result.netProfit).toBe(-500);
    expect(result.profitMargin).toBe(-12.5);
    expect(result.deliveryRevenue).toBe(0);
    expect(result.inventoryValue).toBe(0);
  });
});

describe("toProfitReportResults", () => {
  it("maps an array, preserving order", () => {
    const reports = [buildProfitReport({ id: "r-1" }), buildProfitReport({ id: "r-2" })];
    expect(toProfitReportResults(reports).map((r) => r.id)).toEqual(["r-1", "r-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toProfitReportResults([])).toEqual([]);
  });
});
