import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { RenewLicenseUseCase } from "../renew-license.use-case";

describe("RenewLicenseUseCase", () => {
  let licenseRepository: any;
  let useCase: RenewLicenseUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    licenseId: "license-1",
    issueDate: new Date("2027-01-01"),
    expiryDate: new Date("2028-01-01"),
  };

  beforeEach(() => {
    licenseRepository = { findById: vi.fn(), renewAndUpdateCache: vi.fn() };
    licenseRepository.findById.mockResolvedValue(
      buildLicense({ currentExpiryDate: new Date("2027-01-01") }),
    );
    licenseRepository.renewAndUpdateCache.mockResolvedValue({
      license: buildLicense({
        currentRenewalId: "renewal-2",
        currentIssueDate: input.issueDate,
        currentExpiryDate: input.expiryDate,
      }),
      renewal: buildLicenseRenewal({
        id: "renewal-2",
        source: "RENEWAL",
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
      }),
    });
    useCase = new RenewLicenseUseCase(licenseRepository);
  });

  it("throws NotFoundError when the license doesn't exist", async () => {
    licenseRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when the license is inactive", async () => {
    licenseRepository.findById.mockResolvedValue(buildLicense({ isActive: false }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("rejects a new expiryDate that doesn't move forward from the current one", async () => {
    licenseRepository.findById.mockResolvedValue(
      buildLicense({ currentExpiryDate: new Date("2028-06-01") }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("rejects issueDate after expiryDate", async () => {
    await expect(
      useCase.execute({
        ...input,
        issueDate: new Date("2028-02-01"),
        expiryDate: new Date("2028-01-01"),
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("delegates the renew to renewAndUpdateCache with the license id", async () => {
    await useCase.execute(input);
    expect(licenseRepository.renewAndUpdateCache).toHaveBeenCalledWith(
      "license-1",
      expect.objectContaining({
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        recordedById: "owner-1",
      }),
    );
  });

  it("creates a RENEWAL-source row, not another INITIAL", async () => {
    const result = await useCase.execute(input);
    expect(result.renewal.source).toBe("RENEWAL");
  });

  it("updates the license cache to point at the new renewal", async () => {
    const result = await useCase.execute(input);
    expect(result.license.currentExpiryDate).toEqual(input.expiryDate);
  });
});
