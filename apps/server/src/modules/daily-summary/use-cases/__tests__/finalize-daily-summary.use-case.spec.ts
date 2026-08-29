import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { FinalizeDailySummaryUseCase } from "../finalize-daily-summary.use-case";

describe("FinalizeDailySummaryUseCase", () => {
  let summaryRepo: any;
  let events: any;
  let useCase: FinalizeDailySummaryUseCase;

  beforeEach(() => {
    summaryRepo = {
      findByIdOrThrow: vi
        .fn()
        .mockResolvedValue(buildDailySummary({ status: "DRAFT", voidedAt: null })),
      finalizeIfDraft: vi.fn().mockResolvedValue(1),
    };
    events = { emit: vi.fn() };
    useCase = new FinalizeDailySummaryUseCase(summaryRepo, events);
  });

  it("throws AuthorizationError for STAFF, even a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", isSupervisor: true });
    await expect(useCase.execute(requester, "summary-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1"),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "MANAGER" }), "summary-1"),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when the summary is voided", async () => {
    summaryRepo.findByIdOrThrow.mockResolvedValue(buildDailySummary({ voidedAt: new Date() }));
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when already finalized (fast-fail before the guarded update)", async () => {
    summaryRepo.findByIdOrThrow.mockResolvedValue(
      buildDailySummary({ status: "FINALIZED", voidedAt: null }),
    );
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1")).rejects.toThrow(
      BusinessRuleError,
    );
    expect(summaryRepo.finalizeIfDraft).not.toHaveBeenCalled();
  });

  it("throws BusinessRuleError when finalizeIfDraft reports 0 affected (concurrent race)", async () => {
    summaryRepo.finalizeIfDraft.mockResolvedValue(0);
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("passes the requester's userId as finalizedById", async () => {
    const requester = buildRequestUser({ userId: "user-owner-1", role: "OWNER" });
    await useCase.execute(requester, "summary-1");
    expect(summaryRepo.finalizeIfDraft).toHaveBeenCalledWith("summary-1", "user-owner-1");
  });

  it("emits DAILY_SUMMARY_FINALIZED with shopId, closingBalance, and variance", async () => {
    const finalized = buildDailySummary({
      status: "FINALIZED",
      closingBalance: 20000,
      variance: 500,
    });
    summaryRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildDailySummary({ status: "DRAFT" }))
      .mockResolvedValueOnce(finalized);
    await useCase.execute(buildRequestUser({ userId: "user-owner-1", role: "OWNER" }), "summary-1");
    expect(events.emit).toHaveBeenCalledWith(
      "summary:finalized",
      expect.objectContaining({
        summaryId: finalized.id,
        shopId: finalized.shopId,
        closingBalance: 20000,
        variance: 500,
        finalizedById: "user-owner-1",
      }),
    );
  });

  it("returns the re-fetched, finalized summary", async () => {
    const finalized = buildDailySummary({ status: "FINALIZED" });
    summaryRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildDailySummary({ status: "DRAFT" }))
      .mockResolvedValueOnce(finalized);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "summary-1");
    expect(result).toEqual(finalized);
  });
});
