// use-cases/__tests__/update-category.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { UpdateCategoryUseCase } from "../update-category.use-case";

function buildP2002Error(target: string[] = ["name"]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

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
        categoryId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF targets a different shop's category", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        categoryId: "category-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("succeeds without collision-checking when the name is unchanged", async () => {
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      categoryId: "category-1",
      name: "Bakery",
    });
    expect(result).toBeDefined();
  });

  it("translates a P2002 race on update into a ConflictError", async () => {
    categoryRepository.update.mockRejectedValue(buildP2002Error());
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
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
        categoryId: "category-1",
        name: "Dup",
      }),
    ).rejects.toThrow(error);
  });

  it("passes only the provided fields to the repository update", async () => {
    await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
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
      categoryId: "category-1",
      name: "Bakery Updated",
    });
    expect(result.name).toBe("Bakery Updated");
  });
});
