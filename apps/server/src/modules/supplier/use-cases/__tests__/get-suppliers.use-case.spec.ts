// use-cases/__tests__/get-suppliers.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { GetSuppliersUseCase } from "../get-suppliers.use-case";

describe("GetSuppliersUseCase", () => {
  let supplierRepository: any;
  let useCase: GetSuppliersUseCase;

  beforeEach(() => {
    supplierRepository = { findAll: vi.fn().mockResolvedValue([]) };
    useCase = new GetSuppliersUseCase(supplierRepository);
  });

  it("throws AuthorizationError when STAFF requests a different shop", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        shopId: "shop-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("delegates categoryId and isActive filters to the repository", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
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
      shopId: "shop-1",
    });
    expect(result.suppliers).toHaveLength(1);
  });
});
