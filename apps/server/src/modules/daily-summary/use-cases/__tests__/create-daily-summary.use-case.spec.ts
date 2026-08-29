import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateDailySummaryUseCase } from "../create-daily-summary.use-case";

describe("CreateDailySummaryUseCase", () => {
  let summaryRepo: any;
  let shopRepo: any;
  let tillRepo: any;
  let scratchRepo: any;
  let deliveryRepo: any;
  let expenseRepo: any;
  let useCase: CreateDailySummaryUseCase;

  const input = { shopId: "shop-1", date: new Date("2026-01-15"), closingBalance: 15000 };

  beforeEach(() => {
    summaryRepo = {
      findLatestBefore: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(buildDailySummary()),
    };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    tillRepo = {
      getCategoryTotals: vi.fn().mockResolvedValue([
        { category: "SALES", totalAmount: 7000 },
        { category: "DEPOSIT", totalAmount: 1000 },
        { category: "EXPENSE", totalAmount: 1500 },
        { category: "WITHDRAWAL", totalAmount: 500 },
      ]),
    };
    scratchRepo = {
      getSummaryByGame: vi
        .fn()
        .mockResolvedValue([{ gameId: "game-1", ticketsSold: 10, revenueCents: 3000 }]),
    };
    deliveryRepo = {
      getTotalsByDeliveredAtDate: vi.fn().mockResolvedValue({
        totalAmountCents: 1500,
        bySupplier: [{ supplierId: "s-1", totalAmountCents: 1500, totalPaidCents: 1500 }],
      }),
    };
    expenseRepo = {
      getTotalsByExpenseDate: vi.fn().mockResolvedValue({
        totalCents: 2500,
        byCategory: [{ categoryId: "c-1", amountCents: 2500 }],
      }),
    };
    useCase = new CreateDailySummaryUseCase(
      summaryRepo,
      shopRepo,
      tillRepo,
      scratchRepo,
      deliveryRepo,
      expenseRepo,
    );
  });

  describe("authorization", () => {
    it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
      const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
      await expect(useCase.execute(requester, input)).rejects.toThrow(AuthorizationError);
    });

    it("allows STAFF who is a supervisor, for their own shop", async () => {
      const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
      await expect(useCase.execute(requester, input)).resolves.toBeDefined();
    });

    it("throws AuthorizationError when a supervisor STAFF targets a different shop", async () => {
      const requester = buildRequestUser({
        role: "STAFF",
        shopId: "other-shop",
        isSupervisor: true,
      });
      await expect(useCase.execute(requester, input)).rejects.toThrow(AuthorizationError);
    });

    it("allows OWNER regardless of isSupervisor", async () => {
      const requester = buildRequestUser({ role: "OWNER", shopId: null, isSupervisor: false });
      await expect(useCase.execute(requester, input)).resolves.toBeDefined();
    });

    it("allows MANAGER for any shop", async () => {
      const requester = buildRequestUser({
        role: "MANAGER",
        shopId: "other-shop",
        isSupervisor: false,
      });
      await expect(useCase.execute(requester, input)).resolves.toBeDefined();
    });
  });

  it("throws BusinessRuleError when the shop doesn't exist", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when the shop is inactive", async () => {
    shopRepo.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      BusinessRuleError,
    );
  });

  describe("opening balance resolution", () => {
    it("uses the explicitly provided openingBalance when given", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), {
        ...input,
        openingBalance: 5000,
      });
      expect(summaryRepo.findLatestBefore).not.toHaveBeenCalled();
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalance: 5000 }),
      );
    });

    it("auto-chains from the previous summary's closingBalance when not provided", async () => {
      summaryRepo.findLatestBefore.mockResolvedValue(buildDailySummary({ closingBalance: 9999 }));
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalance: 9999 }),
      );
    });

    it("defaults to 0 when there is no previous summary (first-ever close)", async () => {
      summaryRepo.findLatestBefore.mockResolvedValue(null);
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalance: 0 }),
      );
    });
  });

  describe("aggregation", () => {
    it("computes totalCashIn as SALES + DEPOSIT", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalCashIn: 8000 }),
      );
    });

    it("computes totalCashOut as EXPENSE + WITHDRAWAL", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalCashOut: 2000 }),
      );
    });

    it("ignores till categories not in the IN/OUT split (defensive — none exist today, but the sum should not silently include unknowns)", async () => {
      tillRepo.getCategoryTotals.mockResolvedValue([
        { category: "SALES", totalAmount: 1000 },
        { category: "SOME_FUTURE_CATEGORY", totalAmount: 99999 },
      ]);
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalCashIn: 1000 }),
      );
    });

    it("sums scratchRevenue across all games", async () => {
      scratchRepo.getSummaryByGame.mockResolvedValue([
        { gameId: "g-1", ticketsSold: 5, revenueCents: 1000 },
        { gameId: "g-2", ticketsSold: 3, revenueCents: 600 },
      ]);
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ scratchRevenue: 1600 }),
      );
    });

    it("takes deliveryExpense directly from the delivery repository's total", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryExpense: 1500 }),
      );
    });

    it("takes otherExpense directly from the expense repository's total", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ otherExpense: 2500 }),
      );
    });

    it("always sets otherIncome to 0 — no schema source exists", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ otherIncome: 0 }));
    });

    it("computes variance via the reconciliation formula from the assembled aggregates", async () => {
      // opening 0 (no prior) + cashIn 8000 - cashOut 2000 + scratch 3000 - delivery 1500 + 0 - otherExpense 2500 = 5000 expected
      // closingBalance provided = 15000 -> variance = 15000 - 5000 = 10000
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      expect(summaryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ variance: 10000 }));
    });
  });

  describe("breakdown snapshot", () => {
    it("reshapes till category totals into a { category: amount } map", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      const call = summaryRepo.create.mock.calls[0][0];
      expect(call.breakdown.tillByCategory).toEqual({
        SALES: 7000,
        DEPOSIT: 1000,
        EXPENSE: 1500,
        WITHDRAWAL: 500,
      });
    });

    it("includes scratchByGame, deliveryBySupplier, and expenseByCategory verbatim", async () => {
      await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
      const call = summaryRepo.create.mock.calls[0][0];
      expect(call.breakdown.scratchByGame).toEqual([
        { gameId: "game-1", ticketsSold: 10, revenueCents: 3000 },
      ]);
      expect(call.breakdown.deliveryBySupplier).toEqual([
        { supplierId: "s-1", totalAmountCents: 1500, totalPaidCents: 1500 },
      ]);
      expect(call.breakdown.expenseByCategory).toEqual([{ categoryId: "c-1", amountCents: 2500 }]);
    });
  });

  it("passes the requester's userId as createdById", async () => {
    const requester = buildRequestUser({ userId: "user-42", role: "OWNER" });
    await useCase.execute(requester, input);
    expect(summaryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: "user-42" }),
    );
  });

  it("always creates with status: DRAFT", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(summaryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }));
  });

  it("defaults notes to null when omitted", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(summaryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
  });

  it("passes notes through when given", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), { ...input, notes: "Slow day" });
    expect(summaryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: "Slow day" }));
  });

  it("propagates a ConflictError thrown by the repository on duplicate close unchanged", async () => {
    const { ConflictError } = await import("../../../../common/errors");
    summaryRepo.create.mockRejectedValue(
      new ConflictError(
        "A daily summary for this date already exists — void it before creating a new one",
      ),
    );
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), input)).rejects.toThrow(
      ConflictError,
    );
  });

  it("queries all 4 source repositories for the correct UTC day bounds / exact date", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(tillRepo.getCategoryTotals).toHaveBeenCalledWith(
      "shop-1",
      expect.any(Date),
      expect.any(Date),
    );
    expect(scratchRepo.getSummaryByGame).toHaveBeenCalledWith("shop-1", input.date, input.date);
    expect(deliveryRepo.getTotalsByDeliveredAtDate).toHaveBeenCalledWith("shop-1", input.date);
    expect(expenseRepo.getTotalsByExpenseDate).toHaveBeenCalledWith("shop-1", input.date);
  });
});
