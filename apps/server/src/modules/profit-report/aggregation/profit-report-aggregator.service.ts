import { Injectable } from "@nestjs/common";
import { DailySummaryRepository } from "../../daily-summary/repositories/daily-summary.repository";
import { DeliveryRepository } from "../../delivery/repositories/delivery.repository";
import {
  type ExpenseBucketTotals,
  ExpenseRepository,
} from "../../expense/repositories/expense.repository";
import { ScratchPackRepository } from "../../scratch/repositories/scratch-pack.repository";
import { ScratchScanEventRepository } from "../../scratch/repositories/scratch-scan-event.repository";

export interface ProfitReportRawAggregate {
  scratchRevenue: number;
  deliveryRevenue: number; // always 0 — no Invoice/Delivery.revenueCents source
  otherRevenue: number;
  deliveryCost: number;
  scratchCardsCount: number;
  inventoryValue: number; // point-in-time SNAPSHOT from ScratchPack ACTIVE packs
  uncoveredDates: string[]; // dates in range with no FINALIZED DailySummary
  expenseBuckets: ExpenseBucketTotals;
}

// Matches breakdownSchema in daily-summary.contract.ts exactly.
interface DailySummaryBreakdown {
  tillByCategory?: Record<string, number>;
  scratchByGame?: { gameId: string; ticketsSold: number; revenueCents: number }[];
  deliveryBySupplier?: { supplierId: string; totalAmountCents: number; totalPaidCents: number }[];
  expenseByCategory?: { categoryId: string; amountCents: number }[];
}

// Single source of truth for "what calendar day is this instant" — every
// date-key comparison in this file (coveredDates, uncoveredDates, range
// bounds) goes through this so they can't drift relative to each other.
function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = toUtcMidnight(from);
  const end = toUtcMidnight(to);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class ProfitReportAggregatorService {
  constructor(
    private readonly summaryRepo: DailySummaryRepository,
    private readonly scratchRepo: ScratchScanEventRepository,
    private readonly packRepo: ScratchPackRepository,
    private readonly deliveryRepo: DeliveryRepository,
    private readonly expenseRepo: ExpenseRepository,
  ) {}

  async aggregate(
    shopId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ProfitReportRawAggregate> {
    // Normalize once here — every downstream date comparison (repo range
    // query, coveredDates, eachDate) operates on the same UTC-midnight
    // instants instead of whatever time-of-day the caller passed in.
    const rangeStart = toUtcMidnight(periodStart);
    const rangeEnd = toUtcMidnight(periodEnd);

    // summaries + inventory snapshot in parallel — inventory is a
    // point-in-time value, not additive across gap dates.
    const [summaries, inventoryValue] = await Promise.all([
      this.summaryRepo.findFinalizedInRange(shopId, rangeStart, rangeEnd),
      this.packRepo.getInventoryValue(shopId),
    ]);
    const coveredDates = new Set(summaries.map((s) => toDateKey(s.date)));

    const bucketsFromSummaries = await this.bucketsFromDailySummaries(summaries, inventoryValue);

    const uncoveredDates = eachDate(rangeStart, rangeEnd)
      .map(toDateKey)
      .filter((d) => !coveredDates.has(d));

    if (uncoveredDates.length === 0) {
      return { ...bucketsFromSummaries, uncoveredDates: [] } as ProfitReportRawAggregate;
    }

    // Gap fallback — only for dates with no FINALIZED DailySummary.
    const gapResults = await Promise.all(
      uncoveredDates.map((iso) => this.aggregateRawDate(shopId, new Date(iso))),
    );

    const merged = gapResults.reduce(
      (acc, cur) => ({
        scratchRevenue: acc.scratchRevenue + cur.scratchRevenue,
        deliveryRevenue: acc.deliveryRevenue + cur.deliveryRevenue,
        otherRevenue: acc.otherRevenue + cur.otherRevenue,
        deliveryCost: acc.deliveryCost + cur.deliveryCost,
        scratchCardsCount: acc.scratchCardsCount + cur.scratchCardsCount,
        inventoryValue: acc.inventoryValue,
        expenseBuckets: {
          purchaseCost: acc.expenseBuckets.purchaseCost + cur.expenseBuckets.purchaseCost,
          licenseFees: acc.expenseBuckets.licenseFees + cur.expenseBuckets.licenseFees,
          salaryExpense: acc.expenseBuckets.salaryExpense + cur.expenseBuckets.salaryExpense,
          utilityExpense: acc.expenseBuckets.utilityExpense + cur.expenseBuckets.utilityExpense,
          rentExpense: acc.expenseBuckets.rentExpense + cur.expenseBuckets.rentExpense,
          otherExpense: acc.expenseBuckets.otherExpense + cur.expenseBuckets.otherExpense,
        },
      }),
      bucketsFromSummaries,
    );

    return { ...merged, uncoveredDates };
  }

  private async bucketsFromDailySummaries(
    summaries: {
      scratchRevenue: number;
      deliveryExpense: number;
      otherIncome: number;
      otherExpense: number;
      breakdown: unknown;
    }[],
    inventoryValue = 0,
  ): Promise<Omit<ProfitReportRawAggregate, "uncoveredDates">> {
    let scratchRevenue = 0;
    let deliveryCost = 0;
    let otherRevenue = 0;
    let scratchCardsCount = 0;
    let fallbackOtherExpense = 0;

    // Flattened across every summary in the range — one categoryId lookup
    // for the whole period instead of one per summary day.
    const allEntries: { categoryId: string; amountCents: number }[] = [];

    for (const s of summaries) {
      scratchRevenue += s.scratchRevenue;
      deliveryCost += s.deliveryExpense;
      otherRevenue += s.otherIncome;

      const breakdown = s.breakdown as DailySummaryBreakdown | null;

      if (breakdown?.scratchByGame?.length) {
        scratchCardsCount += breakdown.scratchByGame.reduce((sum, g) => sum + g.ticketsSold, 0);
      }

      const entries = breakdown?.expenseByCategory ?? [];
      if (entries.length > 0) {
        allEntries.push(...entries);
      } else {
        // No category breakdown recorded for this day — genuinely missing
        // data, not the default path.
        fallbackOtherExpense += s.otherExpense;
      }
    }

    const expenseBuckets = await this.expenseRepo.bucketAmountsByCategoryEntries(allEntries);
    expenseBuckets.otherExpense += fallbackOtherExpense;

    return {
      scratchRevenue,
      deliveryRevenue: 0,
      otherRevenue,
      deliveryCost,
      scratchCardsCount,
      inventoryValue,
      expenseBuckets,
    };
  }

  private async aggregateRawDate(
    shopId: string,
    date: Date,
  ): Promise<Omit<ProfitReportRawAggregate, "uncoveredDates">> {
    const [scratchByGame, delivery, expenseBuckets] = await Promise.all([
      this.scratchRepo.getSummaryByGame(shopId, date, date),
      this.deliveryRepo.getTotalsByDeliveredAtDate(shopId, date),
      this.expenseRepo.getBucketTotalsByDate(shopId, date),
    ]);

    const scratchRevenue = scratchByGame.reduce((sum, g) => sum + g.revenueCents, 0);
    const scratchCardsCount = scratchByGame.reduce((sum, g) => sum + g.ticketsSold, 0);

    return {
      scratchRevenue,
      deliveryRevenue: 0,
      otherRevenue: 0,
      deliveryCost: delivery.totalAmountCents,
      scratchCardsCount,
      inventoryValue: 0,
      expenseBuckets,
    };
  }
}
