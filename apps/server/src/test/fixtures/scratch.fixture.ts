import type { ScratchGame, ScratchPack, ScratchScanEvent } from "@tapt-api/db";

export function buildScratchGame(overrides: Partial<ScratchGame> = {}): ScratchGame {
  return {
    id: "game-1",
    shopId: "shop-1",
    gameNumber: "1234",
    name: "Lucky 7s",
    priceCents: 500,
    ticketsPerPack: 30,
    isActive: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  } as ScratchGame;
}

export function buildScratchPack(overrides: Partial<ScratchPack> = {}): ScratchPack {
  return {
    id: "pack-1",
    gameId: "game-1",
    shopId: "shop-1",
    serialStart: "000",
    status: "ACTIVE",
    location: "DISPLAY",
    receivedById: "staff-1",
    receivedAt: new Date("2026-07-01T00:00:00.000Z"),
    finishedAt: null,
    returnedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  } as ScratchPack;
}

export function buildScratchScanEvent(overrides: Partial<ScratchScanEvent> = {}): ScratchScanEvent {
  return {
    id: "scan-1",
    packId: "pack-1",
    gameId: "game-1",
    shopId: "shop-1",
    sequenceNumber: 1,
    scanDate: new Date("2026-07-30T00:00:00.000Z"),
    shiftPeriod: "MORNING",
    scannedSerial: "005",
    ticketsSoldSincePrevious: 5,
    ticketsRemaining: 25,
    unitPriceCents: 500,
    revenueCents: 2500,
    scannedById: "staff-1",
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-07-30T09:00:00.000Z"),
    ...overrides,
  } as ScratchScanEvent;
}
