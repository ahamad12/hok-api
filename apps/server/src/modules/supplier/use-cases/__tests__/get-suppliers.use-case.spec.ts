// use-cases/__tests__/get-suppliers.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { GetSuppliersUseCase } from "../get-suppliers.use-case";

describe("GetSuppliersUseCase", () => {
  let supplierRepository: any;
  let shopRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetSuppliersUseCase;

  beforeEach(() => {
    supplierRepository = { findAll: vi.fn().mockResolvedValue([]) };
    shopRepository = { findById: vi.fn() };
    useCase = new GetSuppliersUseCase(supplierRepository, shopRepository as any);
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
  });

  it("throws AuthorizationError when STAFF requests a different shop", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        shopId: "shop-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        shopId: "shop-999",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the shop is soft-deleted", async () => {
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: false }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        shopId: "shop-1",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("defaults isActive to true when the caller omits it (no soft-deleted leak)", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      shopId: "shop-1",
    });
    expect(supplierRepository.findAll).toHaveBeenCalledWith("shop-1", {
      categoryId: undefined,
      isActive: true,
    });
  });

  it("delegates categoryId and isActive filters to the repository", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      shopId: "shop-1",
      categoryId: "category-1",
      isActive: true,
    });
    expect(supplierRepository.findAll).toHaveBeenCalledWith("shop-1", {
      categoryId: "category-1",
      isActive: true,
    });
  });

  it("maps the fetched suppliers", async () => {
    supplierRepository.findAll.mockResolvedValue([buildSupplier()]);
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      shopId: "shop-1",
    });
    expect(result.suppliers).toHaveLength(1);
  });
});
