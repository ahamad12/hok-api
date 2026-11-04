import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildProfitReport } from "../../../../test/fixtures/profit-report.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { GenerateProfitReportUseCase } from "../generate-profit-report.use-case";

describe("GenerateProfitReportUseCase", () => {
  let reportRepo: any;
  let shopRepo: any;
  let aggregator: any;
  let events: any;
  let pdfQueue: any;
  let useCase: GenerateProfitReportUseCase;

  const input = {
    shopId: "shop-1",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
  };

  beforeEach(() => {
    reportRepo = { create: vi.fn().mockResolvedValue(buildProfitReport()) };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    aggregator = {
      aggregate: vi.fn().mockResolvedValue({
        scratchRevenue: 5000,
        deliveryRevenue: 0,
        otherRevenue: 300,
        deliveryCost: 1200,
        scratchCardsCount: 42,
        inventoryValue: 0,
        uncoveredDates: [],
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
    events = { emit: vi.fn() };
    pdfQueue = { add: vi.fn().mockResolvedValue(undefined) };
    useCase = new GenerateProfitReportUseCase(reportRepo, shopRepo, aggregator, events, pdfQueue);
  });

  describe("authorization", () => {
    it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
      const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
      await expect(useCase.execute(requester, input)).rejects.toThrow(AuthorizationError);
    });

    it("allows STAFF who is a supervisor for their own shop", async () => {
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

    it("allows OWNER regardless of shopId", async () => {
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

  it("throws BusinessRuleError when periodStart is after periodEnd", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), {
        shopId: "shop-1",
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the shop does not exist", async () => {
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

  it("aggregates via the aggregator and computes totals via the pure calculation", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(aggregator.aggregate).toHaveBeenCalledWith("shop-1", input.periodStart, input.periodEnd);
    expect(reportRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scratchRevenue: 5000,
        deliveryRevenue: 0,
        otherRevenue: 300,
        totalRevenue: 5300, // 5000+0+300
        purchaseCost: 800,
        deliveryCost: 1200,
        grossProfit: 4500, // 5300-800
        netProfit: 1450, // 5300-3850
      }),
    );
  });

  it("passes the requester's userId as generatedById", async () => {
    const requester = buildRequestUser({ userId: "user-42", role: "OWNER" });
    await useCase.execute(requester, input);
    expect(reportRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ generatedById: "user-42" }),
    );
  });

  it("emits PROFIT_REPORT_GENERATED with shopId, period, netProfit, profitMargin, generatedById", async () => {
    const report = buildProfitReport({ id: "report-1", netProfit: 1450, profitMargin: 27.35 });
    reportRepo.create.mockResolvedValue(report);
    const requester = buildRequestUser({ userId: "user-owner-1", role: "OWNER" });
    await useCase.execute(requester, input);
    expect(events.emit).toHaveBeenCalledWith(
      "report:generated",
      expect.objectContaining({
        reportId: "report-1",
        shopId: "shop-1",
        netProfit: 1450,
        profitMargin: 27.35,
        generatedById: "user-owner-1",
      }),
    );
  });

  it("enqueues a PDF job and does not block the response", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(pdfQueue.add).toHaveBeenCalledWith("generate-pnl-pdf", { profitReportId: "report-1" });
  });

  it("returns the created report", async () => {
    const report = buildProfitReport();
    reportRepo.create.mockResolvedValue(report);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), input);
    expect(result).toEqual(report);
  });
});
