import { Injectable } from "@nestjs/common";
import type { DailySummaryStatus } from "@tapt-api/db";
import { UserRole } from "@tapt-api/db";
import { computeVariance } from "../../../common/domain/daily-summary-reconciliation";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DeliveryRepository } from "../../delivery/repositories/delivery.repository";
import { ExpenseRepository } from "../../expense/repositories/expense.repository";
import { ScratchScanEventRepository } from "../../scratch/repositories/scratch-scan-event.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { TillEntryRepository } from "../../till-entry/repositories/till-entry.repository";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

interface CreateDailySummaryInput {
  shopId: string;
  date: Date;
  openingBalance?: number;
  closingBalance: number;
  notes?: string;
}

// TillEntryCategory→cash-flow-direction split, matching get-till-summary.use-case.ts's
// IN=[SALES,DEPOSIT] / OUT=[EXPENSE,WITHDRAWAL] convention exactly — do not
// redefine this split anywhere else; if it changes, it changes here and in
// get-till-summary.use-case.ts together, or the two reports will disagree.
const CASH_IN_CATEGORIES = ["SALES", "DEPOSIT"] as const;
const CASH_OUT_CATEGORIES = ["EXPENSE", "WITHDRAWAL"] as const;

function utcDayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
  const dayEnd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
  return { dayStart, dayEnd };
}

@Injectable()
export class CreateDailySummaryUseCase {
  constructor(
    private readonly summaryRepo: DailySummaryRepository,
    private readonly shopRepo: ShopRepository,
    private readonly tillRepo: TillEntryRepository,
    private readonly scratchRepo: ScratchScanEventRepository,
    private readonly deliveryRepo: DeliveryRepository,
    private readonly expenseRepo: ExpenseRepository,
  ) {}

  async execute(requester: RequestUser, input: CreateDailySummaryInput) {
    const isAuthorized = requester.role !== UserRole.STAFF || requester.isSupervisor;
    if (!isAuthorized) {
      throw new AuthorizationError("Only a supervisor, manager, or owner can close the day");
    }
    if (!canAccessShop(requester, input.shopId)) {
      throw new AuthorizationError("Cannot close a day outside your shop");
    }

    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    const openingBalance = await this.resolveOpeningBalance(
      input.shopId,
      input.date,
      input.openingBalance,
    );

    const { dayStart, dayEnd } = utcDayBounds(input.date);

    const [tillCategoryTotals, scratchByGame, delivery, expense] = await Promise.all([
      this.tillRepo.getCategoryTotals(input.shopId, dayStart, dayEnd), // returns {category, totalAmount}[]
      this.scratchRepo.getSummaryByGame(input.shopId, input.date, input.date), // @db.Date exact match, single day
      this.deliveryRepo.getTotalsByDeliveredAtDate(input.shopId, input.date), // NEW method
      this.expenseRepo.getTotalsByExpenseDate(input.shopId, input.date), // NEW method
    ]);

    const totalCashIn = sumCategoryTotals(tillCategoryTotals, CASH_IN_CATEGORIES);
    const totalCashOut = sumCategoryTotals(tillCategoryTotals, CASH_OUT_CATEGORIES);
    const scratchRevenue = scratchByGame.reduce((sum, g) => sum + g.revenueCents, 0);

    const aggregates = {
      openingBalance,
      closingBalance: input.closingBalance,
      totalCashIn,
      totalCashOut,
      scratchRevenue,
      deliveryExpense: delivery.totalAmountCents,
      otherIncome: 0, // no schema source exists for "other income" distinct from till sales — see daily-summary-reconciliation.ts
      otherExpense: expense.totalCents,
    };

    const variance = computeVariance(aggregates);

    return this.summaryRepo.create({
      shopId: input.shopId,
      date: input.date,
      status: "DRAFT" as DailySummaryStatus,
      ...aggregates,
      variance,
      breakdown: {
        // Object.fromEntries here for display convenience only — the
        // repository call above returns the array shape, this reshapes it
        // for the JSON snapshot's { category: amount } lookup form.
        tillByCategory: Object.fromEntries(
          tillCategoryTotals.map((t) => [t.category, t.totalAmount]),
        ),
        scratchByGame: scratchByGame.map((g) => ({
          gameId: g.gameId,
          ticketsSold: g.ticketsSold,
          revenueCents: g.revenueCents,
        })),
        deliveryBySupplier: delivery.bySupplier,
        expenseByCategory: expense.byCategory,
      },
      notes: input.notes ?? null,
      createdById: requester.userId,
    });
  }

  private async resolveOpeningBalance(
    shopId: string,
    date: Date,
    provided?: number,
  ): Promise<number> {
    if (provided !== undefined) return provided;
    const previous = await this.summaryRepo.findLatestBefore(shopId, date);
    return previous?.closingBalance ?? 0;
  }
}

function sumCategoryTotals(
  totals: { category: string; totalAmount: number }[],
  categories: readonly string[],
): number {
  return totals
    .filter((t) => categories.includes(t.category))
    .reduce((sum, t) => sum + t.totalAmount, 0);
}
