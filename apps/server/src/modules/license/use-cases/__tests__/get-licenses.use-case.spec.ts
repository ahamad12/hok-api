import { UserRole } from "@tapt-api/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetLicensesUseCase } from "../get-licenses.use-case";

describe("GetLicensesUseCase", () => {
  let licenseRepository: { findAll: ReturnType<typeof vi.fn> };
  let useCase: GetLicensesUseCase;

  const base = {
    requesterRole: UserRole.MANAGER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId: "shop-1",
    limit: 50,
    offset: 0,
  };

  const asOf = new Date("2026-01-01T00:00:00.000Z");

  beforeEach(() => {
    licenseRepository = { findAll: vi.fn().mockResolvedValue({ licenses: [], total: 0 }) };
    useCase = new GetLicensesUseCase(licenseRepository as any);
    vi.useFakeTimers();
    vi.setSystemTime(asOf);
  });

  it("throws AuthorizationError when STAFF requests a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF scoped to their own shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "shop-1" }),
    ).resolves.toBeDefined();
  });

  it("passes shopId and isActive through to the repository", async () => {
    await useCase.execute({ ...base, isActive: true });
    expect(licenseRepository.findAll).toHaveBeenCalledWith(
      { shopId: "shop-1", isActive: true, isExpired: undefined },
      { limit: 50, offset: 0 },
    );
  });

  it("filters out non-expiring-soon rows in memory when isExpiringSoon is requested", async () => {
    licenseRepository.findAll.mockResolvedValue({
      licenses: [
        buildLicense({ id: "soon", remindDays: 7, currentExpiryDate: new Date("2026-01-05") }),
        buildLicense({ id: "far", remindDays: 7, currentExpiryDate: new Date("2026-06-01") }),
      ],
      total: 2,
    });
    const result = await useCase.execute({ ...base, isExpiringSoon: true });
    expect(result.licenses.map((l) => l.id)).toEqual(["soon"]);
  });

  it("passes isExpired through to the repository (pushed to SQL, no in-memory filter)", async () => {
    licenseRepository.findAll.mockResolvedValue({
      licenses: [buildLicense({ id: "expired", currentExpiryDate: new Date("2025-01-01") })],
      total: 1,
    });
    const result = await useCase.execute({ ...base, isExpired: true });
    expect(licenseRepository.findAll).toHaveBeenCalledWith(
      { shopId: "shop-1", isActive: undefined, isExpired: true },
      { limit: 50, offset: 0 },
    );
    expect(result.licenses.map((l) => l.id)).toEqual(["expired"]);
  });

  it("returns the repository's total even when the mapped array is filtered shorter (known C1 tradeoff)", async () => {
    licenseRepository.findAll.mockResolvedValue({
      licenses: [
        buildLicense({ id: "far", remindDays: 7, currentExpiryDate: new Date("2026-06-01") }),
      ],
      total: 1,
    });
    const result = await useCase.execute({ ...base, isExpiringSoon: true });
    expect(result.licenses).toHaveLength(0);
    expect(result.total).toBe(1); // intentionally NOT re-derived from the filtered array
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
