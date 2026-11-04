import { Injectable } from "@nestjs/common";
import { computeProfitReportTotals } from "../../../common/domain/profit-report-calculation";
import { BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ProfitReportAggregatorService } from "../aggregation/profit-report-aggregator.service";
import { assertProfitReportAccess } from "../profit-report-access.util";

@Injectable()
export class PreviewProfitReportUseCase {
  constructor(private readonly aggregator: ProfitReportAggregatorService) {}

  // Same guards as generate, no persistence, no event, no PDF job —
  // "what-if before I commit the close."
  async execute(
    requester: RequestUser,
    query: { shopId: string; periodStart: Date; periodEnd: Date },
  ) {
    assertProfitReportAccess(requester, query.shopId);
    if (query.periodStart > query.periodEnd) {
      throw new BusinessRuleError("periodStart must be on or before periodEnd");
    }

    const raw = await this.aggregator.aggregate(query.shopId, query.periodStart, query.periodEnd);
    const totals = computeProfitReportTotals(
      {
        scratchRevenue: raw.scratchRevenue,
        deliveryRevenue: raw.deliveryRevenue,
        otherRevenue: raw.otherRevenue,
      },
      { ...raw.expenseBuckets, deliveryCost: raw.deliveryCost },
    );

    return {
      shopId: query.shopId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      scratchRevenue: raw.scratchRevenue,
      deliveryRevenue: raw.deliveryRevenue,
      otherRevenue: raw.otherRevenue,
      purchaseCost: raw.expenseBuckets.purchaseCost,
      deliveryCost: raw.deliveryCost,
      licenseFees: raw.expenseBuckets.licenseFees,
      salaryExpense: raw.expenseBuckets.salaryExpense,
      utilityExpense: raw.expenseBuckets.utilityExpense,
      rentExpense: raw.expenseBuckets.rentExpense,
      otherExpense: raw.expenseBuckets.otherExpense,
      scratchCardsCount: raw.scratchCardsCount,
      inventoryValue: raw.inventoryValue,
      uncoveredDates: raw.uncoveredDates,
      ...totals,
    };
  }
}
