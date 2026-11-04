import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import type { Queue } from "bullmq";
import { computeProfitReportTotals } from "../../../common/domain/profit-report-calculation";
import { BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { ProfitReportAggregatorService } from "../aggregation/profit-report-aggregator.service";
import { PROFIT_REPORT_PDF_QUEUE } from "../profit-report.constants";
import { assertProfitReportAccess } from "../profit-report-access.util";
import { ProfitReportRepository } from "../repositories/profit-report.repository";

interface GenerateProfitReportInput {
  shopId: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class GenerateProfitReportUseCase {
  constructor(
    private readonly reportRepo: ProfitReportRepository,
    private readonly shopRepo: ShopRepository,
    private readonly aggregator: ProfitReportAggregatorService,
    private readonly events: EventEmitter2,
    @InjectQueue(PROFIT_REPORT_PDF_QUEUE) private readonly pdfQueue: Queue,
  ) {}

  async execute(requester: RequestUser, input: GenerateProfitReportInput) {
    assertProfitReportAccess(requester, input.shopId);
    if (input.periodStart > input.periodEnd) {
      throw new BusinessRuleError("periodStart must be on or before periodEnd");
    }

    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    const raw = await this.aggregator.aggregate(input.shopId, input.periodStart, input.periodEnd);

    const totals = computeProfitReportTotals(
      {
        scratchRevenue: raw.scratchRevenue,
        deliveryRevenue: raw.deliveryRevenue,
        otherRevenue: raw.otherRevenue,
      },
      { ...raw.expenseBuckets, deliveryCost: raw.deliveryCost },
    );

    const report = await this.reportRepo.create({
      shopId: input.shopId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      scratchRevenue: raw.scratchRevenue,
      deliveryRevenue: raw.deliveryRevenue,
      otherRevenue: raw.otherRevenue,
      totalRevenue: totals.totalRevenue,
      purchaseCost: raw.expenseBuckets.purchaseCost,
      deliveryCost: raw.deliveryCost,
      licenseFees: raw.expenseBuckets.licenseFees,
      salaryExpense: raw.expenseBuckets.salaryExpense,
      utilityExpense: raw.expenseBuckets.utilityExpense,
      rentExpense: raw.expenseBuckets.rentExpense,
      otherExpense: raw.expenseBuckets.otherExpense,
      totalExpense: totals.totalExpense,
      grossProfit: totals.grossProfit,
      netProfit: totals.netProfit,
      profitMargin: totals.profitMargin,
      scratchCardsCount: raw.scratchCardsCount,
      inventoryValue: raw.inventoryValue,
      generatedById: requester.userId,
    });

    this.events.emit(SOCKET_EVENTS.PROFIT_REPORT_GENERATED, {
      reportId: report.id,
      shopId: report.shopId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      netProfit: report.netProfit,
      profitMargin: report.profitMargin,
      generatedById: requester.userId,
    });

    // PDF render is async — never block the request on Chromium.
    await this.pdfQueue.add("generate-pnl-pdf", { profitReportId: report.id });

    return report;
  }
}
