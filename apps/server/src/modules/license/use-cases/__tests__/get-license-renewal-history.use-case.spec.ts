import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetLicenseRenewalHistoryUseCase } from "../get-license-renewal-history.use-case";

describe("GetLicenseRenewalHistoryUseCase", () => {
  let licenseRepository: { findById: ReturnType<typeof vi.fn> };
  let licenseRenewalRepository: { findByLicense: ReturnType<typeof vi.fn> };
  let useCase: GetLicenseRenewalHistoryUseCase;

  beforeEach(() => {
    licenseRepository = { findById: vi.fn() };
    licenseRenewalRepository = { findByLicense: vi.fn().mockResolvedValue([]) };
    useCase = new GetLicenseRenewalHistoryUseCase(
      licenseRepository as any,
      licenseRenewalRepository as any,
    );
    licenseRepository.findById.mockResolvedValue(buildLicense({ shopId: "shop-1" }));
  });

  it("throws NotFoundError when the license doesn't exist", async () => {
    licenseRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        licenseId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests history for a different shop's license", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        licenseId: "license-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("returns the full renewal list mapped, including voided rows", async () => {
    licenseRenewalRepository.findByLicense.mockResolvedValue([
      buildLicenseRenewal({ id: "r2", source: "RENEWAL" }),
      buildLicenseRenewal({ id: "r1", source: "INITIAL", voidedAt: new Date() }),
    ]);
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      licenseId: "license-1",
    });
    expect(result.renewals.map((r) => r.id)).toEqual(["r2", "r1"]);
  });
});
