// use-cases/__tests__/update-category.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { UpdateCategoryUseCase } from "../update-category.use-case";

describe("UpdateCategoryUseCase", () => {
  let categoryRepository: any;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    categoryRepository = {
      findById: vi.fn().mockResolvedValue(buildCategory({ name: "Bakery" })),
      update: vi.fn().mockResolvedValue(buildCategory({ name: "Bakery Updated" })),
    };
    useCase = new UpdateCategoryUseCase(categoryRepository);
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

  it("throws AuthorizationError when STAFF targets a different shop's category", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        categoryId: "category-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("succeeds without collision-checking when the name is unchanged", async () => {
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      categoryId: "category-1",
      name: "Bakery",
    });
    expect(result).toBeDefined();
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    categoryRepository.update.mockRejectedValue(
      new ConflictError("A category with this name already exists for this shop"),
    );
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        categoryId: "category-1",
        name: "Dup",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from update", async () => {
    const error = new Error("database down");
    categoryRepository.update.mockRejectedValue(error);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        categoryId: "category-1",
        name: "Dup",
      }),
    ).rejects.toThrow(error);
  });

  it("passes only the provided fields to the repository update", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      categoryId: "category-1",
      isActive: false,
    });
    expect(categoryRepository.update).toHaveBeenCalledWith("category-1", {
      name: undefined,
      description: undefined,
      isActive: false,
    });
  });

  it("returns the mapped updated category", async () => {
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      categoryId: "category-1",
      name: "Bakery Updated",
    });
    expect(result.name).toBe("Bakery Updated");
  });
});
