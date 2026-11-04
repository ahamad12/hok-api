// modules/till-entry/use-cases/__tests__/get-till-summary.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetTillSummaryUseCase } from "../get-till-summary.use-case";

describe("GetTillSummaryUseCase", () => {
  let repo: {
    getCategoryTotals: ReturnType<typeof vi.fn>;
    getCategoryTotalsBefore: ReturnType<typeof vi.fn>;
  };
  let useCase: GetTillSummaryUseCase;
  const base = {
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId: "shop-1",
    date: new Date("2026-07-30T15:00:00.000Z"),
  };

  beforeEach(() => {
    repo = {
      getCategoryTotals: vi.fn().mockResolvedValue([]),
      getCategoryTotalsBefore: vi.fn().mockResolvedValue([]),
    };
    useCase = new GetTillSummaryUseCase(repo as any);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("computes day boundaries in UTC regardless of time-of-day in the input", async () => {
    await useCase.execute(base);
    const [, from, to] = repo.getCategoryTotals.mock.calls[0]!;
    expect(from.toISOString()).toBe("2026-07-30T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-30T23:59:59.999Z");
  });

  it("a reversed entry nets to zero once the DB layer sums original + reversal together", async () => {
    repo.getCategoryTotals.mockResolvedValue([{ category: "EXPENSE", totalAmount: 0 }]); // 5000 + (-5000)
    const result = await useCase.execute(base);
    expect(result.totalCashOut).toBe(0);
  });

  it("computes expectedClosingBalance as opening + cashIn - cashOut", async () => {
    repo.getCategoryTotalsBefore.mockResolvedValue([{ category: "SALES", totalAmount: 1000 }]);
    repo.getCategoryTotals.mockResolvedValue([
      { category: "SALES", totalAmount: 500 },
      { category: "EXPENSE", totalAmount: 200 },
    ]);
    const result = await useCase.execute(base);
    expect(result.expectedClosingBalance).toBe(1300);
  });

  it("returns null variance/actualClosingBalance when not provided", async () => {
    const result = await useCase.execute(base);
    expect(result.actualClosingBalance).toBeNull();
    expect(result.variance).toBeNull();
  });

  it("computes variance as actual - expected, positive for overage negative for shortage", async () => {
    const over = await useCase.execute({ ...base, actualClosingBalance: 1000 });
    expect(over.variance).toBe(1000 - over.expectedClosingBalance);
  });

  it("all breakdown categories default to 0 with no activity", async () => {
    const result = await useCase.execute(base);
    expect(result.breakdown).toEqual({ SALES: 0, DEPOSIT: 0, EXPENSE: 0, WITHDRAWAL: 0 });
  });
});
