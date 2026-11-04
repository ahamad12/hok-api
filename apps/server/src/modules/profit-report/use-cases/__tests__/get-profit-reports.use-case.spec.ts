import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetProfitReportsUseCase } from "../get-profit-reports.use-case";

describe("GetProfitReportsUseCase", () => {
  let reportRepo: any;
  let useCase: GetProfitReportsUseCase;

  beforeEach(() => {
    reportRepo = { findAll: vi.fn().mockResolvedValue({ reports: [], total: 0 }) };
    useCase = new GetProfitReportsUseCase(reportRepo);
  });

  it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF supervisor for their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("throws AuthorizationError when a supervisor STAFF targets a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "other-shop", isSupervisor: true });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), {
        shopId: "shop-1",
        limit: 20,
        offset: 0,
      }),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER for any shop", async () => {
    const requester = buildRequestUser({
      role: "MANAGER",
      shopId: "other-shop",
      isSupervisor: false,
    });
    await expect(
      useCase.execute(requester, { shopId: "shop-1", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("delegates to the repository with the exact query and returns its result", async () => {
    const query = {
      shopId: "shop-1",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      limit: 20,
      offset: 0,
    };
    const expected = { reports: [{ id: "r-1" }], total: 1 };
    reportRepo.findAll.mockResolvedValue(expected as any);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), query);
    expect(reportRepo.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });
});
