import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { VoidDailySummaryUseCase } from "../void-daily-summary.use-case";

describe("VoidDailySummaryUseCase", () => {
  let summaryRepo: any;
  let events: any;
  let useCase: VoidDailySummaryUseCase;

  beforeEach(() => {
    summaryRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildDailySummary({ voidedAt: null })),
      voidIfNotVoided: vi.fn().mockResolvedValue(1),
    };
    events = { emit: vi.fn() };
    useCase = new VoidDailySummaryUseCase(summaryRepo, events);
  });

  it("throws AuthorizationError for STAFF", async () => {
    const requester = buildRequestUser({ role: "STAFF", isSupervisor: true });
    await expect(useCase.execute(requester, "summary-1", "Miscounted")).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1", "Miscounted"),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "MANAGER" }), "summary-1", "Miscounted"),
    ).resolves.toBeDefined();
  });

  it("allows voiding a FINALIZED summary — voiding is how a wrong close is corrected", async () => {
    summaryRepo.findByIdOrThrow.mockResolvedValue(
      buildDailySummary({ status: "FINALIZED", voidedAt: null }),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1", "Wrong count"),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError (fast-fail) when already voided", async () => {
    summaryRepo.findByIdOrThrow.mockResolvedValue(buildDailySummary({ voidedAt: new Date() }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1", "x"),
    ).rejects.toThrow(BusinessRuleError);
    expect(summaryRepo.voidIfNotVoided).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError when voidIfNotVoided reports 0 affected (concurrent race)", async () => {
    summaryRepo.voidIfNotVoided.mockResolvedValue(0);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1", "x"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("passes voidedById and voidReason through to the repository", async () => {
    const requester = buildRequestUser({ userId: "user-owner-1", role: "OWNER" });
    await useCase.execute(requester, "summary-1", "Miscounted till");
    expect(summaryRepo.voidIfNotVoided).toHaveBeenCalledWith("summary-1", {
      voidedById: "user-owner-1",
      voidReason: "Miscounted till",
    });
  });

  it("emits DAILY_SUMMARY_VOIDED after a successful void", async () => {
    const voided = buildDailySummary({ voidedAt: new Date(), voidedById: "user-owner-1" });
    summaryRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildDailySummary({ voidedAt: null }))
      .mockResolvedValueOnce(voided);
    await useCase.execute(
      buildRequestUser({ userId: "user-owner-1", role: "OWNER" }),
      "summary-1",
      "Miscounted",
    );
    expect(events.emit).toHaveBeenCalledWith(
      "summary:voided",
      expect.objectContaining({
        summaryId: voided.id,
        shopId: voided.shopId,
        voidedById: "user-owner-1",
      }),
    );
  });

  it("returns the re-fetched, voided summary", async () => {
    const voided = buildDailySummary({ voidedAt: new Date(), voidReason: "Miscounted" });
    summaryRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildDailySummary({ voidedAt: null }))
      .mockResolvedValueOnce(voided);
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "summary-1",
      "Miscounted",
    );
    expect(result).toEqual(voided);
  });
});
