import type { ProfitReport } from "@tapt-api/db";

export type ProfitReportResult = Pick<
  ProfitReport,
  | "id"
  | "shopId"
  | "periodStart"
  | "periodEnd"
  | "scratchRevenue"
  | "deliveryRevenue"
  | "otherRevenue"
  | "totalRevenue"
  | "purchaseCost"
  | "deliveryCost"
  | "licenseFees"
  | "salaryExpense"
  | "utilityExpense"
  | "rentExpense"
  | "otherExpense"
  | "totalExpense"
  | "grossProfit"
  | "netProfit"
  | "profitMargin"
  | "scratchCardsCount"
  | "inventoryValue"
  | "generatedAt"
  | "generatedById"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
>;

export function toProfitReportResult(report: ProfitReport): ProfitReportResult {
  const {
    id,
    shopId,
    periodStart,
    periodEnd,
    scratchRevenue,
    deliveryRevenue,
    otherRevenue,
    totalRevenue,
    purchaseCost,
    deliveryCost,
    licenseFees,
    salaryExpense,
    utilityExpense,
    rentExpense,
    otherExpense,
    totalExpense,
    grossProfit,
    netProfit,
    profitMargin,
    scratchCardsCount,
    inventoryValue,
    generatedAt,
    generatedById,
    voidedAt,
    voidedById,
    voidReason,
  } = report;
  return {
    id,
    shopId,
    periodStart,
    periodEnd,
    scratchRevenue,
    deliveryRevenue,
    otherRevenue,
    totalRevenue,
    purchaseCost,
    deliveryCost,
    licenseFees,
    salaryExpense,
    utilityExpense,
    rentExpense,
    otherExpense,
    totalExpense,
    grossProfit,
    netProfit,
    profitMargin,
    scratchCardsCount,
    inventoryValue,
    generatedAt,
    generatedById,
    voidedAt,
    voidedById,
    voidReason,
  };
}

export function toProfitReportResults(reports: ProfitReport[]): ProfitReportResult[] {
  return reports.map(toProfitReportResult);
}
