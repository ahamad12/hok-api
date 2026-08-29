import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetDailySummaryByDateUseCase } from "../get-daily-summary-by-date.use-case";

describe("GetDailySummaryByDateUseCase", () => {
  let summaryRepo: any;
  let useCase: GetDailySummaryByDateUseCase;

  beforeEach(() => {
    summaryRepo = {
      findByShopAndDate: vi.fn().mockResolvedValue(buildDailySummary({ shopId: "shop-1" })),
    };
    useCase = new GetDailySummaryByDateUseCase(summaryRepo);
  });

  it("throws AuthorizationError when STAFF looks up a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "shop-1", new Date("2026-01-15"))).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows STAFF to look up their own shop's date", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, "shop-1", new Date("2026-01-15")),
    ).resolves.toBeDefined();
  });

  it("allows OWNER/MANAGER for any shop", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(
      useCase.execute(requester, "shop-1", new Date("2026-01-15")),
    ).resolves.toBeDefined();
  });

  it("throws NotFoundError when no summary exists for that shop and date", async () => {
    summaryRepo.findByShopAndDate.mockResolvedValue(null);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "shop-1", new Date("2026-01-15")),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns the summary when found", async () => {
    const summary = buildDailySummary({ shopId: "shop-1" });
    summaryRepo.findByShopAndDate.mockResolvedValue(summary);
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "shop-1",
      new Date("2026-01-15"),
    );
    expect(result).toEqual(summary);
  });
});
