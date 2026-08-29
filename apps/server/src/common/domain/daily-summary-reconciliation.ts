export interface DailySummaryAggregates {
  openingBalance: number;
  closingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  scratchRevenue: number;
  deliveryExpense: number;
  otherIncome: number;
  otherExpense: number;
}

export function computeExpectedClosingBalance(a: DailySummaryAggregates): number {
  return (
    a.openingBalance +
    a.totalCashIn -
    a.totalCashOut +
    a.scratchRevenue -
    a.deliveryExpense +
    a.otherIncome -
    a.otherExpense
  );
}

export function computeVariance(a: DailySummaryAggregates): number {
  return a.closingBalance - computeExpectedClosingBalance(a);
}
