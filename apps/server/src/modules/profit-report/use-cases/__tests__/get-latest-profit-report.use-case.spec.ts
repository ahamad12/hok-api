import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetLatestProfitReportUseCase } from "../get-latest-profit-report.use-case";

describe("GetLatestProfitReportUseCase", () => {
  let reportRepo: any;
  let useCase: GetLatestProfitReportUseCase;

  beforeEach(() => {
    reportRepo = { findLatest: vi.fn().mockResolvedValue(null) };
    useCase = new GetLatestProfitReportUseCase(reportRepo);
  });

  it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
    await expect(useCase.execute(requester, "shop-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF supervisor for their own shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
    await expect(useCase.execute(requester, "shop-1")).resolves.toBeDefined();
  });

  it("throws AuthorizationError when a supervisor STAFF requests another shop's latest", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "other-shop", isSupervisor: true });
    await expect(useCase.execute(requester, "shop-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "shop-1"),
    ).resolves.toBeDefined();
  });

  it("delegates to findLatest with the shopId and returns its result", async () => {
    const report = { id: "report-1", shopId: "shop-1" };
    reportRepo.findLatest.mockResolvedValue(report as any);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "shop-1");
    expect(reportRepo.findLatest).toHaveBeenCalledWith("shop-1");
    expect(result).toEqual(report);
  });

  it("returns null when there are no reports for the shop", async () => {
    reportRepo.findLatest.mockResolvedValue(null);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "shop-1"),
    ).resolves.toBeNull();
  });
});
