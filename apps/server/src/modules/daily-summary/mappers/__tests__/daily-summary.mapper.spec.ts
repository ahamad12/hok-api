import { describe, expect, it } from "vitest";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { toDailySummaryResult, toDailySummaryResults } from "../daily-summary.mapper";

describe("toDailySummaryResult", () => {
  it("maps all whitelisted fields", () => {
    const summary = buildDailySummary();
    expect(toDailySummaryResult(summary)).toEqual({
      id: summary.id,
      shopId: summary.shopId,
      date: summary.date,
      status: summary.status,
      openingBalance: summary.openingBalance,
      closingBalance: summary.closingBalance,
      totalCashIn: summary.totalCashIn,
      totalCashOut: summary.totalCashOut,
      scratchRevenue: summary.scratchRevenue,
      deliveryExpense: summary.deliveryExpense,
      otherIncome: summary.otherIncome,
      otherExpense: summary.otherExpense,
      variance: summary.variance,
      breakdown: summary.breakdown,
      notes: summary.notes,
      createdById: summary.createdById,
      finalizedAt: summary.finalizedAt,
      finalizedById: summary.finalizedById,
      voidedAt: summary.voidedAt,
      voidedById: summary.voidedById,
      voidReason: summary.voidReason,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toDailySummaryResult(buildDailySummary());
    expect(Object.keys(result).sort()).toEqual(
      [
        "breakdown",
        "closingBalance",
        "createdAt",
        "createdById",
        "date",
        "deliveryExpense",
        "finalizedAt",
        "finalizedById",
        "id",
        "notes",
        "openingBalance",
        "otherExpense",
        "otherIncome",
        "scratchRevenue",
        "shopId",
        "status",
        "totalCashIn",
        "totalCashOut",
        "updatedAt",
        "variance",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });

  it("passes through null finalize/void fields on a fresh draft", () => {
    const result = toDailySummaryResult(
      buildDailySummary({
        finalizedAt: null,
        finalizedById: null,
        voidedAt: null,
        voidedById: null,
        voidReason: null,
      }),
    );
    expect(result.finalizedAt).toBeNull();
    expect(result.finalizedById).toBeNull();
    expect(result.voidedAt).toBeNull();
    expect(result.voidedById).toBeNull();
    expect(result.voidReason).toBeNull();
  });

  it("carries through populated finalize fields on a finalized summary", () => {
    const finalizedAt = new Date("2026-01-16");
    const result = toDailySummaryResult(
      buildDailySummary({ status: "FINALIZED", finalizedAt, finalizedById: "user-owner-1" }),
    );
    expect(result.status).toBe("FINALIZED");
    expect(result.finalizedAt).toEqual(finalizedAt);
    expect(result.finalizedById).toBe("user-owner-1");
  });

  it("carries through populated void fields", () => {
    const voidedAt = new Date("2026-01-17");
    const result = toDailySummaryResult(
      buildDailySummary({ voidedAt, voidedById: "user-owner-1", voidReason: "Miscounted till" }),
    );
    expect(result.voidedAt).toEqual(voidedAt);
    expect(result.voidedById).toBe("user-owner-1");
    expect(result.voidReason).toBe("Miscounted till");
  });

  it("passes the breakdown object through unchanged, not recomputed", () => {
    const breakdown = {
      tillByCategory: { SALES: 999 },
      scratchByGame: [],
      deliveryBySupplier: [],
      expenseByCategory: [],
    };
    const result = toDailySummaryResult(buildDailySummary({ breakdown }));
    expect(result.breakdown).toEqual(breakdown);
  });
});

describe("toDailySummaryResults", () => {
  it("maps an array, preserving order", () => {
    const summaries = [buildDailySummary({ id: "s-1" }), buildDailySummary({ id: "s-2" })];
    expect(toDailySummaryResults(summaries).map((s) => s.id)).toEqual(["s-1", "s-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toDailySummaryResults([])).toEqual([]);
  });
});
