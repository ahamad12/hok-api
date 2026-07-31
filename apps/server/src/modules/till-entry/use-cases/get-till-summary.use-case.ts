// modules/till-entry/use-cases/get-till-summary.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { TillEntryRepository } from "../repositories/till-entry.repository";

const IN_CATEGORIES = ["SALES", "DEPOSIT"] as const;
const OUT_CATEGORIES = ["EXPENSE", "WITHDRAWAL"] as const;

function sumByCategories(
  totals: Array<{ category: string; totalAmount: number }>,
  categories: readonly string[],
): number {
  return totals
    .filter((t) => categories.includes(t.category))
    .reduce((sum, t) => sum + t.totalAmount, 0);
}

function categoryBreakdown(totals: Array<{ category: string; totalAmount: number }>) {
  const breakdown = { SALES: 0, DEPOSIT: 0, EXPENSE: 0, WITHDRAWAL: 0 };
  for (const t of totals)
    if (t.category in breakdown) breakdown[t.category as keyof typeof breakdown] = t.totalAmount;
  return breakdown;
}

// UTC-explicit day boundaries — independent of the server process's TZ,
// unlike Date.setHours(0,0,0,0) which mutates in local server time.
function utcDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
  return { start, end };
}

export interface GetTillSummaryInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  date: Date;
  actualClosingBalance?: number;
}

export interface TillSummaryResult {
  shopId: string;
  date: Date;
  openingBalance: number;
  expectedClosingBalance: number;
  actualClosingBalance: number | null;
  variance: number | null;
  totalCashIn: number;
  totalCashOut: number;
  breakdown: { SALES: number; DEPOSIT: number; EXPENSE: number; WITHDRAWAL: number };
}

@Injectable()
export class GetTillSummaryUseCase {
  constructor(private readonly tillEntryRepository: TillEntryRepository) {}

  async execute(input: GetTillSummaryInput): Promise<TillSummaryResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { start: dayStart, end: dayEnd } = utcDayBounds(input.date);

    const [dayTotals, previousTotals] = await Promise.all([
      this.tillEntryRepository.getCategoryTotals(input.shopId, dayStart, dayEnd),
      this.tillEntryRepository.getCategoryTotalsBefore(input.shopId, dayStart),
    ]);

    const totalCashIn = sumByCategories(dayTotals, IN_CATEGORIES);
    const totalCashOut = sumByCategories(dayTotals, OUT_CATEGORIES);
    const openingBalance =
      sumByCategories(previousTotals, IN_CATEGORIES) -
      sumByCategories(previousTotals, OUT_CATEGORIES);
    const expectedClosingBalance = openingBalance + totalCashIn - totalCashOut;

    let actualClosingBalance: number | null = null;
    let variance: number | null = null;
    if (input.actualClosingBalance !== undefined) {
      actualClosingBalance = input.actualClosingBalance;
      variance = actualClosingBalance - expectedClosingBalance;
    }

    return {
      shopId: input.shopId,
      date: input.date,
      openingBalance,
      expectedClosingBalance,
      actualClosingBalance,
      variance,
      totalCashIn,
      totalCashOut,
      breakdown: categoryBreakdown(dayTotals),
    };
  }
}
