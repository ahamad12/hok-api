import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildProfitReport } from "../../../../test/fixtures/profit-report.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetProfitReportByIdUseCase } from "../get-profit-report-by-id.use-case";

describe("GetProfitReportByIdUseCase", () => {
  let reportRepo: any;
  let useCase: GetProfitReportByIdUseCase;

  beforeEach(() => {
    reportRepo = { findByIdOrThrow: vi.fn().mockResolvedValue(buildProfitReport()) };
    useCase = new GetProfitReportByIdUseCase(reportRepo);
  });

  it("throws AuthorizationError for STAFF who is not a supervisor", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: false });
    await expect(useCase.execute(requester, "report-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF supervisor for their own shop's report", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
    await expect(useCase.execute(requester, "report-1")).resolves.toBeDefined();
  });

  it("throws AuthorizationError when a supervisor STAFF targets a report outside their shop", async () => {
    reportRepo.findByIdOrThrow.mockResolvedValue(buildProfitReport({ shopId: "other-shop" }));
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1", isSupervisor: true });
    await expect(useCase.execute(requester, "report-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "report-1"),
    ).resolves.toBeDefined();
  });

  it("allows MANAGER", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "MANAGER" }), "report-1"),
    ).resolves.toBeDefined();
  });

  it("delegates to findByIdOrThrow and returns the report", async () => {
    const report = buildProfitReport();
    reportRepo.findByIdOrThrow.mockResolvedValue(report);
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "report-1");
    expect(reportRepo.findByIdOrThrow).toHaveBeenCalledWith("report-1");
    expect(result).toEqual(report);
  });
});
