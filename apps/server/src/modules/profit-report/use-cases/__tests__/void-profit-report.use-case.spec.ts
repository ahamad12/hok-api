import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildProfitReport } from "../../../../test/fixtures/profit-report.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { VoidProfitReportUseCase } from "../void-profit-report.use-case";

describe("VoidProfitReportUseCase", () => {
  let reportRepo: any;
  let events: any;
  let useCase: VoidProfitReportUseCase;

  beforeEach(() => {
    reportRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildProfitReport({ voidedAt: null })),
      voidIfNotVoided: vi.fn().mockResolvedValue(1),
    };
    events = { emit: vi.fn() };
    useCase = new VoidProfitReportUseCase(reportRepo, events);
  });

  it("throws AuthorizationError for STAFF, even a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", isSupervisor: true });
    await expect(useCase.execute(requester, "report-1", "Duplicate period")).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "report-1", "Duplicate period"),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "MANAGER" }), "report-1", "Duplicate period"),
    ).resolves.toBeDefined();
  });

  it("allows voiding regardless of shop — OWNER/MANAGER are cross-shop", async () => {
    // No shopId check — void is cross-shop for OWNER/MANAGER by design.
    reportRepo.findByIdOrThrow.mockResolvedValue(buildProfitReport({ shopId: "other-shop" }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER", shopId: "shop-1" }), "report-1", "x"),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError (fast-fail) when already voided", async () => {
    reportRepo.findByIdOrThrow.mockResolvedValue(buildProfitReport({ voidedAt: new Date() }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "report-1", "x"),
    ).rejects.toThrow(BusinessRuleError);
    expect(reportRepo.voidIfNotVoided).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError when voidIfNotVoided reports 0 affected (concurrent race)", async () => {
    reportRepo.voidIfNotVoided.mockResolvedValue(0);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "report-1", "x"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("passes voidedById and voidReason through to the repository", async () => {
    const requester = buildRequestUser({ userId: "user-owner-1", role: "OWNER" });
    await useCase.execute(requester, "report-1", "Duplicate period");
    expect(reportRepo.voidIfNotVoided).toHaveBeenCalledWith("report-1", {
      voidedById: "user-owner-1",
      voidReason: "Duplicate period",
    });
  });

  it("emits PROFIT_REPORT_VOIDED after a successful void", async () => {
    const voided = buildProfitReport({ voidedAt: new Date(), voidedById: "user-owner-1" } as any);
    reportRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildProfitReport({ voidedAt: null }))
      .mockResolvedValueOnce(voided);
    await useCase.execute(
      buildRequestUser({ userId: "user-owner-1", role: "OWNER" }),
      "report-1",
      "Duplicate period",
    );
    expect(events.emit).toHaveBeenCalledWith(
      "report:voided",
      expect.objectContaining({
        reportId: voided.id,
        shopId: voided.shopId,
        voidedById: "user-owner-1",
      }),
    );
  });

  it("returns the re-fetched, voided report", async () => {
    const voided = buildProfitReport({
      voidedAt: new Date(),
      voidReason: "Duplicate period",
    } as any);
    reportRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildProfitReport({ voidedAt: null }))
      .mockResolvedValueOnce(voided);
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "report-1",
      "Duplicate period",
    );
    expect(result).toEqual(voided);
  });
});
