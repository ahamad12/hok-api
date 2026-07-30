// modules/till-entry/mappers/__tests__/till-entry.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { toTillEntryResult } from "../till-entry.mapper";

describe("toTillEntryResult", () => {
  it("maps all whitelisted fields", () => {
    const entry = buildTillEntry();
    expect(toTillEntryResult(entry)).toEqual({
      id: entry.id,
      shopId: entry.shopId,
      category: entry.category,
      amount: entry.amount,
      description: entry.description,
      billUrl: entry.billUrl,
      recordedById: entry.recordedById,
      transactionDate: entry.transactionDate,
      reversesEntryId: entry.reversesEntryId,
      correctionReason: entry.correctionReason,
      createdAt: entry.createdAt,
    });
  });

  it("preserves a negative amount on a reversal row rather than coercing it", () => {
    const reversal = buildTillEntry({ amount: -5000, reversesEntryId: "entry-1" });
    expect(toTillEntryResult(reversal).amount).toBe(-5000);
  });

  it("does not leak any field beyond the whitelisted set", () => {
    const result = toTillEntryResult(buildTillEntry());
    expect(Object.keys(result).sort()).toEqual(
      [
        "amount",
        "billUrl",
        "category",
        "correctionReason",
        "createdAt",
        "description",
        "id",
        "recordedById",
        "reversesEntryId",
        "shopId",
        "transactionDate",
      ].sort(),
    );
  });
});
