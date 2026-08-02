// use-cases/__tests__/update-supplier.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { UpdateSupplierUseCase } from "../update-supplier.use-case";

describe("UpdateSupplierUseCase", () => {
  let supplierRepository: any;
  let categoryRepository: any;
  let useCase: UpdateSupplierUseCase;

  beforeEach(() => {
    supplierRepository = {
      findById: vi.fn().mockResolvedValue(buildSupplier({ name: "Acme Wholesale" })),
      update: vi.fn().mockResolvedValue(buildSupplier({ name: "Acme Updated" })),
    };
    categoryRepository = {
      findById: vi.fn().mockResolvedValue(buildCategory({ id: "category-1", shopId: "shop-1" })),
    };
    useCase = new UpdateSupplierUseCase(supplierRepository, categoryRepository);
  });

  it("throws NotFoundError when the supplier doesn't exist", async () => {
    supplierRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        supplierId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF targets a different shop's supplier", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        supplierId: "supplier-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws NotFoundError when changing to a category that doesn't exist", async () => {
    categoryRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        supplierId: "supplier-1",
        categoryId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when the new category belongs to a different shop", async () => {
    categoryRepository.findById.mockResolvedValue(
      buildCategory({ id: "category-9", shopId: "some-other-shop" }),
    );
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        supplierId: "supplier-1",
        categoryId: "category-9",
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("skips the category validation when categoryId is unchanged or not provided", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      supplierId: "supplier-1",
      name: "Acme Updated",
    });
    expect(categoryRepository.findById).not.toHaveBeenCalled();
  });

  it("passes only the provided fields to the repository update", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      supplierId: "supplier-1",
      isActive: false,
    });
    expect(supplierRepository.update).toHaveBeenCalledWith("supplier-1", {
      categoryId: undefined,
      name: undefined,
      phone: undefined,
      address: undefined,
      isActive: false,
    });
  });

  it("returns the mapped updated supplier", async () => {
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      supplierId: "supplier-1",
      name: "Acme Updated",
    });
    expect(result.name).toBe("Acme Updated");
  });
});
