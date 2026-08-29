import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetDailySummaryByIdUseCase } from "../get-daily-summary-by-id.use-case";

describe("GetDailySummaryByIdUseCase", () => {
  let summaryRepo: any;
  let useCase: GetDailySummaryByIdUseCase;

  beforeEach(() => {
    summaryRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildDailySummary({ shopId: "shop-1" })),
    };
    useCase = new GetDailySummaryByIdUseCase(summaryRepo);
  });

  it("throws AuthorizationError when STAFF views a different shop's summary", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "summary-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF to view their own shop's summary", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "summary-1")).resolves.toBeDefined();
  });

  it("allows OWNER/MANAGER regardless of shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, "summary-1")).resolves.toBeDefined();
  });

  it("propagates NotFoundError from the repository", async () => {
    summaryRepo.findByIdOrThrow.mockRejectedValue(new Error("not found"));
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), "missing")).rejects.toThrow();
  });
});
