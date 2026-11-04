// use-cases/__tests__/get-category-by-id.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetCategoryByIdUseCase } from "../get-category-by-id.use-case";

describe("GetCategoryByIdUseCase", () => {
  let categoryRepository: any;
  let useCase: GetCategoryByIdUseCase;

  beforeEach(() => {
    categoryRepository = { findById: vi.fn() };
    useCase = new GetCategoryByIdUseCase(categoryRepository);
  });

  it("throws NotFoundError when the category doesn't exist", async () => {
    categoryRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        categoryId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests a different shop's category", async () => {
    categoryRepository.findById.mockResolvedValue(buildCategory({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-2",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        categoryId: "category-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("returns the mapped category", async () => {
    categoryRepository.findById.mockResolvedValue(buildCategory());
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      categoryId: "category-1",
    });
    expect(result.id).toBe("category-1");
  });
});
