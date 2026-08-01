import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { UpdateLicenseUseCase } from "../update-license.use-case";

describe("UpdateLicenseUseCase", () => {
  let licenseRepository: {
    findById: ReturnType<typeof vi.fn>;
    existsByLicenseNumber: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateLicenseUseCase;

  const input = {
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    licenseId: "license-1",
    productName: "Renamed License",
  };

  beforeEach(() => {
    licenseRepository = { findById: vi.fn(), existsByLicenseNumber: vi.fn(), update: vi.fn() };
    useCase = new UpdateLicenseUseCase(licenseRepository as any);
    licenseRepository.findById.mockResolvedValue(
      buildLicense({ shopId: "shop-1", licenseNumber: "TB-2026-001" }),
    );
    licenseRepository.update.mockResolvedValue(buildLicense({ productName: "Renamed License" }));
  });

  it("throws NotFoundError when the license doesn't exist", async () => {
    licenseRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when remindDays is negative", async () => {
    await expect(useCase.execute({ ...input, remindDays: -1 })).rejects.toThrow(BusinessRuleError);
  });

  it("allows remindDays of exactly 0", async () => {
    await expect(useCase.execute({ ...input, remindDays: 0 })).resolves.toBeDefined();
  });

  it("skips the licenseNumber uniqueness check when licenseNumber is unchanged", async () => {
    await useCase.execute({ ...input, licenseNumber: "TB-2026-001" });
    expect(licenseRepository.existsByLicenseNumber).not.toHaveBeenCalled();
  });

  it("checks uniqueness only when licenseNumber actually changes", async () => {
    licenseRepository.existsByLicenseNumber.mockResolvedValue(false);
    await useCase.execute({ ...input, licenseNumber: "TB-2026-002" });
    expect(licenseRepository.existsByLicenseNumber).toHaveBeenCalledWith("shop-1", "TB-2026-002");
  });

  it("throws ConflictError when the new licenseNumber collides with another license", async () => {
    licenseRepository.existsByLicenseNumber.mockResolvedValue(true);
    await expect(useCase.execute({ ...input, licenseNumber: "TB-2026-002" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("allows isActive: false as the deactivate path", async () => {
    await useCase.execute({ ...input, isActive: false });
    expect(licenseRepository.update).toHaveBeenCalledWith(
      "license-1",
      expect.objectContaining({ isActive: false }),
    );
  });

  it("does not accept or forward any date fields (dates only change via renew)", async () => {
    await useCase.execute(input);
    const patch = licenseRepository.update.mock.calls[0]![1];
    expect(patch).not.toHaveProperty("issueDate");
    expect(patch).not.toHaveProperty("expiryDate");
  });
});
