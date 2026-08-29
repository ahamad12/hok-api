import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetDailySummariesUseCase } from "../get-daily-summaries.use-case";

describe("GetDailySummariesUseCase", () => {
  let summaryRepo: any;
  let useCase: GetDailySummariesUseCase;

  beforeEach(() => {
    summaryRepo = { findAll: vi.fn().mockResolvedValue({ summaries: [], total: 0 }) };
    useCase = new GetDailySummariesUseCase(summaryRepo);
  });

  it("throws AuthorizationError when STAFF queries a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { shopId: "shop-2", limit: 30, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF to view their own shop's history — this is the primary UI surface, not management-only", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 30, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER for any shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 30, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("delegates the query as-is to the repository", async () => {
    const query = { shopId: "shop-1", status: "FINALIZED" as const, limit: 30, offset: 0 };
    await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    expect(summaryRepo.findAll).toHaveBeenCalledWith(query);
  });
});
