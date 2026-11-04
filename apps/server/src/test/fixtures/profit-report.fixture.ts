import type { ProfitReport } from "@tapt-api/db";

export function buildProfitReport(overrides: Partial<ProfitReport> = {}): ProfitReport {
  return {
    id: "report-1",
    shopId: "shop-1",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    scratchRevenue: 5000,
    deliveryRevenue: 0,
    otherRevenue: 300,
    totalRevenue: 5300,
    purchaseCost: 800,
    deliveryCost: 1200,
    licenseFees: 100,
    salaryExpense: 900,
    utilityExpense: 200,
    rentExpense: 600,
    otherExpense: 50,
    totalExpense: 3850,
    grossProfit: 4500,
    netProfit: 1450,
    profitMargin: 27.35,
    scratchCardsCount: 42,
    inventoryValue: 0,
    generatedAt: new Date("2026-02-01"),
    generatedById: "user-owner-1",
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-02-01"),
    ...overrides,
  } as ProfitReport;
}
