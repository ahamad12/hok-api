export interface ProfitReportRevenueInputs {
  scratchRevenue: number;
  deliveryRevenue: number;
  otherRevenue: number;
}

export interface ProfitReportExpenseInputs {
  purchaseCost: number;
  deliveryCost: number;
  licenseFees: number;
  salaryExpense: number;
  utilityExpense: number;
  rentExpense: number;
  otherExpense: number;
}

export interface ProfitReportTotals {
  totalRevenue: number;
  totalExpense: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}

// gross = totalRevenue - purchaseCost (cost of goods sold only, not opex)
// net   = totalRevenue - totalExpense (every expense bucket)
// margin = net / totalRevenue * 100, 0 when there's no revenue to divide by
export function computeProfitReportTotals(
  revenue: ProfitReportRevenueInputs,
  expense: ProfitReportExpenseInputs,
): ProfitReportTotals {
  const totalRevenue = revenue.scratchRevenue + revenue.deliveryRevenue + revenue.otherRevenue;
  const totalExpense =
    expense.purchaseCost +
    expense.deliveryCost +
    expense.licenseFees +
    expense.salaryExpense +
    expense.utilityExpense +
    expense.rentExpense +
    expense.otherExpense;
  const grossProfit = totalRevenue - expense.purchaseCost;
  const netProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return { totalRevenue, totalExpense, grossProfit, netProfit, profitMargin };
}
