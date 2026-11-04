import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { VoidLicenseRenewalUseCase } from "../void-license-renewal.use-case";

describe("VoidLicenseRenewalUseCase", () => {
  let licenseRepository: any;
  let licenseRenewalRepository: any;
  let useCase: VoidLicenseRenewalUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    licenseId: "license-1",
    renewalId: "renewal-2",
    voidReason: "Wrong expiry date entered",
  };

  beforeEach(() => {
    licenseRepository = { findById: vi.fn(), voidRenewalAndRecomputeCache: vi.fn() };
    licenseRenewalRepository = { findById: vi.fn(), findByLicense: vi.fn() };
    useCase = new VoidLicenseRenewalUseCase(licenseRepository, licenseRenewalRepository);

    licenseRepository.findById.mockResolvedValue(buildLicense({ currentRenewalId: "renewal-2" }));
    licenseRenewalRepository.findById.mockResolvedValue(
      buildLicenseRenewal({ id: "renewal-2", source: "RENEWAL" }),
    );
    licenseRepository.voidRenewalAndRecomputeCache.mockResolvedValue({
      license: buildLicense({
        currentRenewalId: null,
        currentIssueDate: null,
        currentExpiryDate: null,
      }),
      renewal: buildLicenseRenewal({ id: "renewal-2", voidedAt: new Date() }),
    });
  });

  it("throws BusinessRuleError when the renewal is already voided", async () => {
    licenseRenewalRepository.findById.mockResolvedValue(
      buildLicenseRenewal({ id: "renewal-2", source: "RENEWAL", voidedAt: new Date() }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws NotFoundError when the renewal doesn't belong to this license", async () => {
    licenseRenewalRepository.findById.mockResolvedValue(
      buildLicenseRenewal({ id: "renewal-2", licenseId: "some-other-license" }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("blocks voiding the INITIAL renewal when later renewals exist", async () => {
    licenseRenewalRepository.findById.mockResolvedValue(
      buildLicenseRenewal({ id: "renewal-1", source: "INITIAL" }),
    );
    licenseRenewalRepository.findByLicense.mockResolvedValue([
      buildLicenseRenewal({ id: "renewal-1", source: "INITIAL" }),
      buildLicenseRenewal({ id: "renewal-2", source: "RENEWAL" }),
    ]);
    await expect(useCase.execute({ ...input, renewalId: "renewal-1" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("allows voiding the INITIAL renewal when later renewals are already voided (not just absent)", async () => {
    licenseRenewalRepository.findById.mockResolvedValue(
      buildLicenseRenewal({ id: "renewal-1", source: "INITIAL" }),
    );
    licenseRenewalRepository.findByLicense.mockResolvedValue([
      buildLicenseRenewal({ id: "renewal-1", source: "INITIAL" }),
      buildLicenseRenewal({ id: "renewal-2", source: "RENEWAL", voidedAt: new Date() }),
    ]);
    await expect(useCase.execute({ ...input, renewalId: "renewal-1" })).resolves.toBeDefined();
    expect(licenseRepository.voidRenewalAndRecomputeCache).toHaveBeenCalledWith(
      expect.objectContaining({ id: "license-1" }),
      "renewal-1",
      { voidedById: "owner-1", voidReason: "Wrong expiry date entered" },
      false,
    );
  });

  it("recomputes the license's current-renewal cache when the voided row WAS current", async () => {
    licenseRepository.voidRenewalAndRecomputeCache.mockResolvedValue({
      license: buildLicense({
        currentRenewalId: "renewal-1",
        currentExpiryDate: new Date("2027-01-01"),
      }),
      renewal: buildLicenseRenewal({ id: "renewal-2", voidedAt: new Date() }),
    });
    const result = await useCase.execute(input);
    expect(licenseRepository.voidRenewalAndRecomputeCache).toHaveBeenCalledWith(
      expect.objectContaining({ currentRenewalId: "renewal-2" }),
      "renewal-2",
      { voidedById: "owner-1", voidReason: "Wrong expiry date entered" },
      true,
    );
    expect(result.license.currentExpiryDate).toEqual(new Date("2027-01-01"));
  });
});
