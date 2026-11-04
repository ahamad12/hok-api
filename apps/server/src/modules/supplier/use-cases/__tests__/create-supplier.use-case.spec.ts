// use-cases/__tests__/create-supplier.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { CreateSupplierUseCase } from "../create-supplier.use-case";

describe("CreateSupplierUseCase", () => {
  let supplierRepository: any;
  let categoryRepository: any;
  let shopRepository: any;
  let useCase: CreateSupplierUseCase;

  const input = {
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId: "shop-1",
    categoryId: "category-1",
    name: "Acme Wholesale",
  };

  beforeEach(() => {
    supplierRepository = { create: vi.fn().mockResolvedValue(buildSupplier()) };
    categoryRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(buildCategory({ id: "category-1", shopId: "shop-1", isActive: true })),
    };
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };
    useCase = new CreateSupplierUseCase(supplierRepository, categoryRepository, shopRepository);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(useCase.execute({ ...input, requesterShopId: "other-shop" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("throws NotFoundError when the shop doesn't exist or is inactive", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the category doesn't exist", async () => {
    categoryRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when the category belongs to a different shop", async () => {
    categoryRepository.findById.mockResolvedValue(
      buildCategory({ id: "category-1", shopId: "some-other-shop" }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the category is inactive", async () => {
    categoryRepository.findById.mockResolvedValue(
      buildCategory({ id: "category-1", shopId: "shop-1", isActive: false }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("creates the supplier with null phone/address when omitted and isActive true", async () => {
    await useCase.execute(input);
    expect(supplierRepository.create).toHaveBeenCalledWith({
      shopId: "shop-1",
      categoryId: "category-1",
      name: "Acme Wholesale",
      phone: null,
      address: null,
      isActive: true,
    });
  });

  it("passes phone and address through when given", async () => {
    await useCase.execute({ ...input, phone: "555-0100", address: "1 Wholesale Rd" });
    expect(supplierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "555-0100", address: "1 Wholesale Rd" }),
    );
  });

  it("returns the mapped supplier result", async () => {
    const result = await useCase.execute(input);
    expect(result.name).toBe("Acme Wholesale");
  });
});
