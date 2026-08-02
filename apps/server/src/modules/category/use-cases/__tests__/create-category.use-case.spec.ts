// use-cases/__tests__/create-category.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { CreateCategoryUseCase } from "../create-category.use-case";

function buildP2002Error(target: string[] = ["name"]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("CreateCategoryUseCase", () => {
  let categoryRepository: any;
  let shopRepository: any;
  let useCase: CreateCategoryUseCase;

  const input = {
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    shopId: "shop-1",
    name: "Bakery",
  };

  beforeEach(() => {
    categoryRepository = {
      create: vi.fn().mockResolvedValue(buildCategory({ name: "Bakery" })),
    };
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };
    useCase = new CreateCategoryUseCase(categoryRepository, shopRepository);
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

  it("does not pre-check name existence before creating — goes straight to create", async () => {
    await useCase.execute(input);
    expect(categoryRepository.create).toHaveBeenCalledTimes(1);
  });

  it("translates a P2002 race on create into a ConflictError", async () => {
    categoryRepository.create.mockRejectedValue(buildP2002Error());
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from create", async () => {
    const error = new Error("database down");
    categoryRepository.create.mockRejectedValue(error);
    await expect(useCase.execute(input)).rejects.toThrow(error);
  });

  it("creates the category with description null when omitted and isActive true", async () => {
    await useCase.execute(input);
    expect(categoryRepository.create).toHaveBeenCalledWith({
      shopId: "shop-1",
      name: "Bakery",
      description: null,
      isActive: true,
    });
  });

  it("passes the description through when given", async () => {
    await useCase.execute({ ...input, description: "Fresh baked goods" });
    expect(categoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Fresh baked goods" }),
    );
  });

  it("returns the mapped category result", async () => {
    const result = await useCase.execute(input);
    expect(result.name).toBe("Bakery");
  });
});
