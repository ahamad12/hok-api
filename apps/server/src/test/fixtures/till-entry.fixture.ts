// src/test/fixtures/till-entry.fixture.ts
import type { TillEntry } from "@tapt-api/db";

export function buildTillEntry(overrides: Partial<TillEntry> = {}): TillEntry {
  return {
    id: "entry-1",
    shopId: "shop-1",
    category: "SALES",
    amount: 5000,
    description: "Cash sale",
    billUrl: null,
    recordedById: "staff-1",
    transactionDate: new Date("2026-07-30T10:00:00.000Z"),
    reversesEntryId: null,
    correctionReason: null,
    createdAt: new Date("2026-07-30T10:00:00.000Z"),
    ...overrides,
  } as TillEntry;
}
