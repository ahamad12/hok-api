// use-cases/__tests__/get-categories.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetCategoriesUseCase } from "../get-categories.use-case";

describe("GetCategoriesUseCase", () => {
  let categoryRepository: any;
  let useCase: GetCategoriesUseCase;

  beforeEach(() => {
    categoryRepository = { findAll: vi.fn().mockResolvedValue([]) };
    useCase = new GetCategoriesUseCase(categoryRepository);
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

  it("delegates the isActive filter to the repository", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      shopId: "shop-1",
      isActive: true,
    });
    expect(categoryRepository.findAll).toHaveBeenCalledWith("shop-1", true);
  });

  it("maps the fetched categories", async () => {
    categoryRepository.findAll.mockResolvedValue([buildCategory()]);
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      shopId: "shop-1",
    });
    expect(result.categories).toHaveLength(1);
  });
});
