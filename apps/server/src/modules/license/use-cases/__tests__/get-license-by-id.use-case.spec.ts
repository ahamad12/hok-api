import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { GetLicenseByIdUseCase } from "../get-license-by-id.use-case";

describe("GetLicenseByIdUseCase", () => {
  let licenseRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetLicenseByIdUseCase;

  beforeEach(() => {
    licenseRepository = { findById: vi.fn() };
    useCase = new GetLicenseByIdUseCase(licenseRepository as any);
  });

  it("throws NotFoundError when no license matches", async () => {
    licenseRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        licenseId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests a license from a different shop", async () => {
    licenseRepository.findById.mockResolvedValue(buildLicense({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-2",
        licenseId: "license-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF to fetch a license from their own shop", async () => {
    licenseRepository.findById.mockResolvedValue(buildLicense({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-1",
        licenseId: "license-1",
      }),
    ).resolves.toBeDefined();
  });

  it("allows OWNER/MANAGER to fetch a license from any shop", async () => {
    licenseRepository.findById.mockResolvedValue(buildLicense({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.MANAGER,
        requesterShopId: null,
        licenseId: "license-1",
      }),
    ).resolves.toBeDefined();
  });
});
