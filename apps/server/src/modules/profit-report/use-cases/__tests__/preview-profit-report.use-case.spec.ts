import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { PreviewProfitReportUseCase } from "../preview-profit-report.use-case";

describe("PreviewProfitReportUseCase", () => {
  let aggregator: any;
  let useCase: PreviewProfitReportUseCase;

  const query = {
    shopId: "shop-1",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  };

  beforeEach(() => {
    aggregator = {
      aggregate: vi.fn().mockResolvedValue({
        scratchRevenue: 5000,
        deliveryRevenue: 0,
        otherRevenue: 300,
        deliveryCost: 1200,
        scratchCardsCount: 42,
        inventoryValue: 0,
        uncoveredDates: ["2026-01-15"],
        expenseBuckets: {
          purchaseCost: 800,
          licenseFees: 100,
          salaryExpense: 900,
          utilityExpense: 200,
          rentExpense: 600,
          otherExpense: 50,
        },
      }),
    };
    useCase = new PreviewProfitReportUseCase(aggregator);
  });

  it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
    await expect(useCase.execute(requester, query)).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF supervisor for their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
    await expect(useCase.execute(requester, query)).resolves.toBeDefined();
  });

  it("throws AuthorizationError when a supervisor STAFF targets a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "other-shop", isSupervisor: true });
    await expect(useCase.execute(requester, query)).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), query),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "MANAGER" }), query),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when periodStart is after periodEnd", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), {
        shopId: "shop-1",
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("delegates to the aggregator with the correct bounds", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    expect(aggregator.aggregate).toHaveBeenCalledWith("shop-1", query.periodStart, query.periodEnd);
  });

  it("returns computed totals plus uncoveredDates without persisting", async () => {
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    expect(result).toEqual(
      expect.objectContaining({
        shopId: "shop-1",
        scratchRevenue: 5000,
        deliveryRevenue: 0,
        otherRevenue: 300,
        purchaseCost: 800,
        deliveryCost: 1200,
        totalRevenue: 5300,
        grossProfit: 4500,
        netProfit: 1450,
        uncoveredDates: ["2026-01-15"],
        scratchCardsCount: 42,
        inventoryValue: 0,
      }),
    );
  });

  it("computes the same totals as generate would (pure calculation parity)", async () => {
    const preview = await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    // totalRevenue 5300, totalExpense 3850 => net 1450, margin ~27.35
    expect(preview.totalExpense).toBe(3850);
    expect(preview.netProfit).toBe(1450);
  });
});
