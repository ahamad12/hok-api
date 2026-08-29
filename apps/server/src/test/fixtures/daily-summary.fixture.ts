import type { DailySummary } from "@tapt-api/db";

export function buildDailySummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    id: "summary-1",
    shopId: "shop-1",
    date: new Date("2026-01-15"),
    status: "DRAFT",
    openingBalance: 10000,
    closingBalance: 15000,
    totalCashIn: 8000,
    totalCashOut: 2000,
    scratchRevenue: 3000,
    deliveryExpense: 1500,
    otherIncome: 0,
    otherExpense: 2500,
    variance: 0,
    breakdown: {
      tillByCategory: { SALES: 7000, DEPOSIT: 1000, EXPENSE: 1500, WITHDRAWAL: 500 },
      scratchByGame: [{ gameId: "game-1", ticketsSold: 10, revenueCents: 3000 }],
      deliveryBySupplier: [
        { supplierId: "supplier-1", totalAmountCents: 1500, totalPaidCents: 1500 },
      ],
      expenseByCategory: [{ categoryId: "expense-category-1", amountCents: 2500 }],
    },
    notes: null,
    createdById: "user-owner-1",
    finalizedAt: null,
    finalizedById: null,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  } as DailySummary;
}
