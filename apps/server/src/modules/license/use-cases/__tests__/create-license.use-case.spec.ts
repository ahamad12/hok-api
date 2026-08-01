import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateLicenseUseCase } from "../create-license.use-case";

describe("CreateLicenseUseCase", () => {
  let licenseRepository: { existsByLicenseNumber: ReturnType<typeof vi.fn> };
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let prisma: { $transaction: ReturnType<typeof vi.fn> };
  let useCase: CreateLicenseUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    shopId: "shop-1",
    productName: "Tobacco Retail License",
    licenseNumber: "TB-2026-001",
    issueDate: new Date("2026-01-01"),
    expiryDate: new Date("2027-01-01"),
  };

  let txLicenseCreate: ReturnType<typeof vi.fn>;
  let txRenewalCreate: ReturnType<typeof vi.fn>;
  let txLicenseUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    licenseRepository = { existsByLicenseNumber: vi.fn().mockResolvedValue(false) };
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };

    txLicenseCreate = vi.fn().mockResolvedValue(buildLicense({ id: "license-new" }));
    txRenewalCreate = vi
      .fn()
      .mockResolvedValue(buildLicenseRenewal({ id: "renewal-new", licenseId: "license-new" }));
    txLicenseUpdate = vi
      .fn()
      .mockResolvedValue(buildLicense({ id: "license-new", currentRenewalId: "renewal-new" }));

    prisma = {
      $transaction: vi.fn(async (fn: any) =>
        fn({
          license: { create: txLicenseCreate, update: txLicenseUpdate },
          licenseRenewal: { create: txRenewalCreate },
        }),
      ),
    };

    useCase = new CreateLicenseUseCase(
      licenseRepository as any,
      shopRepository as any,
      prisma as any,
    );
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
    expect(txLicenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ remindDays: 7 }) }),
    );
  });

  it("throws ConflictError when the license number already exists for the shop", async () => {
    licenseRepository.existsByLicenseNumber.mockResolvedValue(true);
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("creates the initial renewal with source INITIAL, not RENEWAL", async () => {
    await useCase.execute(input);
    expect(txRenewalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: "INITIAL" }) }),
    );
  });

  it("points the initial renewal's recordedById at the requester", async () => {
    await useCase.execute(input);
    expect(txRenewalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recordedById: "owner-1" }) }),
    );
  });

  it("updates the license cache to reference the newly created renewal", async () => {
    await useCase.execute(input);
    expect(txLicenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentRenewalId: "renewal-new",
          currentIssueDate: input.issueDate,
          currentExpiryDate: input.expiryDate,
        }),
      }),
    );
  });

  it("runs all three writes inside a single prisma.$transaction", async () => {
    await useCase.execute(input);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the mapped, post-transaction license", async () => {
    const result = await useCase.execute(input);
    expect(result.id).toBe("license-new");
  });
});
