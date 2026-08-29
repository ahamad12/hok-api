import type { DailySummary } from "@tapt-api/db";

export type DailySummaryResult = Pick<
  DailySummary,
  | "id"
  | "shopId"
  | "date"
  | "status"
  | "openingBalance"
  | "closingBalance"
  | "totalCashIn"
  | "totalCashOut"
  | "scratchRevenue"
  | "deliveryExpense"
  | "otherIncome"
  | "otherExpense"
  | "variance"
  | "breakdown"
  | "notes"
  | "createdById"
  | "finalizedAt"
  | "finalizedById"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
  | "updatedAt"
>;

export function toDailySummaryResult(summary: DailySummary): DailySummaryResult {
  const {
    id,
    shopId,
    date,
    status,
    openingBalance,
    closingBalance,
    totalCashIn,
    totalCashOut,
    scratchRevenue,
    deliveryExpense,
    otherIncome,
    otherExpense,
    variance,
    breakdown,
    notes,
    createdById,
    finalizedAt,
    finalizedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  } = summary;
  return {
    id,
    shopId,
    date,
    status,
    openingBalance,
    closingBalance,
    totalCashIn,
    totalCashOut,
    scratchRevenue,
    deliveryExpense,
    otherIncome,
    otherExpense,
    variance,
    breakdown,
    notes,
    createdById,
    finalizedAt,
    finalizedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  };
}

export function toDailySummaryResults(summaries: DailySummary[]): DailySummaryResult[] {
  return summaries.map(toDailySummaryResult);
}
