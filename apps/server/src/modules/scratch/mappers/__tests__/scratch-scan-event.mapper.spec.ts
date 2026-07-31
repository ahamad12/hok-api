// modules/scratch/mappers/__tests__/scratch-scan-event.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildScratchScanEvent } from "../../../../test/fixtures/scratch.fixture";
import { toScratchScanEventResult } from "../scratch-scan-event.mapper";

describe("toScratchScanEventResult", () => {
  it("maps all whitelisted fields", () => {
    const scan = buildScratchScanEvent();
    expect(toScratchScanEventResult(scan)).toEqual({
      id: scan.id,
      packId: scan.packId,
      gameId: scan.gameId,
      shopId: scan.shopId,
      scanDate: scan.scanDate,
      shiftPeriod: scan.shiftPeriod,
      scannedSerial: scan.scannedSerial,
      ticketsSoldSincePrevious: scan.ticketsSoldSincePrevious,
      ticketsRemaining: scan.ticketsRemaining,
      unitPriceCents: scan.unitPriceCents,
      revenueCents: scan.revenueCents,
      scannedById: scan.scannedById,
      voidedAt: scan.voidedAt,
      voidedById: scan.voidedById,
      voidReason: scan.voidReason,
      createdAt: scan.createdAt,
    });
  });

  it("does not leak any field beyond the whitelisted set (e.g. no sequenceNumber)", () => {
    expect(Object.keys(toScratchScanEventResult(buildScratchScanEvent())).sort()).toEqual(
      [
        "createdAt",
        "gameId",
        "id",
        "packId",
        "revenueCents",
        "scanDate",
        "scannedById",
        "scannedSerial",
        "shiftPeriod",
        "shopId",
        "ticketsRemaining",
        "ticketsSoldSincePrevious",
        "unitPriceCents",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });

  it("preserves the void fields on a voided scan", () => {
    const voidedAt = new Date("2026-07-30T10:00:00.000Z");
    const result = toScratchScanEventResult(
      buildScratchScanEvent({ voidedAt, voidedById: "mgr-1", voidReason: "Mistyped serial" }),
    );
    expect(result.voidedAt).toEqual(voidedAt);
    expect(result.voidedById).toBe("mgr-1");
    expect(result.voidReason).toBe("Mistyped serial");
  });
});
