// use-cases/__tests__/get-supplier-by-id.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { GetSupplierByIdUseCase } from "../get-supplier-by-id.use-case";

describe("GetSupplierByIdUseCase", () => {
  let supplierRepository: any;
  let useCase: GetSupplierByIdUseCase;

  beforeEach(() => {
    supplierRepository = { findById: vi.fn() };
    useCase = new GetSupplierByIdUseCase(supplierRepository);
  });

  it("throws NotFoundError when the supplier doesn't exist", async () => {
    supplierRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        supplierId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the supplier is soft-deleted (inactive)", async () => {
    supplierRepository.findById.mockResolvedValue(buildSupplier({ isActive: false }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        supplierId: "supplier-1",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests a different shop's supplier", async () => {
    supplierRepository.findById.mockResolvedValue(buildSupplier({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-2",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        supplierId: "supplier-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("returns the mapped supplier", async () => {
    supplierRepository.findById.mockResolvedValue(buildSupplier());
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      supplierId: "supplier-1",
    });
    expect(result.id).toBe("supplier-1");
  });
});
