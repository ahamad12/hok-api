import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateLicenseUseCase } from "../create-license.use-case";

describe("CreateLicenseUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let licenseRepository: { createWithInitialRenewal: ReturnType<typeof vi.fn> };
  let useCase: CreateLicenseUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId: "shop-1",
    productName: "Tobacco Retail License",
    licenseNumber: "TB-2026-001",
    issueDate: new Date("2026-01-01"),
    expiryDate: new Date("2027-01-01"),
  };

  beforeEach(() => {
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };
    licenseRepository = {
      createWithInitialRenewal: vi.fn().mockResolvedValue(buildLicense({ id: "license-new" })),
    };
    useCase = new CreateLicenseUseCase(shopRepository as any, licenseRepository as any);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF registering a license for their own shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "shop-1" }),
    ).resolves.toBeDefined();
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the shop is inactive", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: false }));
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when issueDate is after expiryDate", async () => {
    await expect(
      useCase.execute({
        ...input,
        issueDate: new Date("2027-06-01"),
        expiryDate: new Date("2027-01-01"),
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when remindDays is negative", async () => {
    await expect(useCase.execute({ ...input, remindDays: -1 })).rejects.toThrow(BusinessRuleError);
  });

  it("defaults remindDays to 7 when not provided", async () => {
    await useCase.execute(input);
    expect(licenseRepository.createWithInitialRenewal).toHaveBeenCalledWith(
      expect.objectContaining({ remindDays: 7 }),
      expect.anything(),
    );
  });

  it("does not pre-check license number uniqueness — delegates straight to createWithInitialRenewal", async () => {
    await useCase.execute(input);
    expect(licenseRepository.createWithInitialRenewal).toHaveBeenCalledTimes(1);
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    licenseRepository.createWithInitialRenewal.mockRejectedValue(
      new ConflictError("A license with this number already exists for this shop"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from the transaction", async () => {
    const error = new Error("database down");
    licenseRepository.createWithInitialRenewal.mockRejectedValue(error);
    await expect(useCase.execute(input)).rejects.toThrow(error);
  });

  it("points the initial renewal's recordedById at the requester", async () => {
    await useCase.execute(input);
    expect(licenseRepository.createWithInitialRenewal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recordedById: "owner-1" }),
    );
  });

  it("forwards the issue and expiry dates into the initial renewal", async () => {
    await useCase.execute(input);
    expect(licenseRepository.createWithInitialRenewal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ issueDate: input.issueDate, expiryDate: input.expiryDate }),
    );
  });

  it("returns the mapped, post-transaction license", async () => {
    const result = await useCase.execute(input);
    expect(result.id).toBe("license-new");
  });
});
