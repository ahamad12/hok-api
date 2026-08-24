// repositories/__tests__/category.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { CategoryRepository } from "../category.repository";

describe("CategoryRepository", () => {
  let prisma: any;
  let repo: CategoryRepository;

  beforeEach(() => {
    prisma = {
      category: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    repo = new CategoryRepository(prisma);
  });

  it("findById delegates to prisma.category.findUnique", async () => {
    const category = buildCategory();
    prisma.category.findUnique.mockResolvedValue(category);
    await expect(repo.findById("category-1")).resolves.toEqual(category);
    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { id: "category-1" } });
  });

  it("findAll scopes by shopId and applies isActive when given", async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await repo.findAll("shop-1", true);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1", isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("findAll omits isActive from the where clause when not given", async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await repo.findAll("shop-1");
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1" },
      orderBy: { name: "asc" },
    });
  });

  it("create delegates to prisma.category.create with the given data", async () => {
    const input = { shopId: "shop-1", name: "Bakery", description: null, isActive: true };
    prisma.category.create.mockResolvedValue(buildCategory());
    await repo.create(input as any);
    expect(prisma.category.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.category.update with the given id and data", async () => {
    const input = { name: "Bakery Updated" };
    prisma.category.update.mockResolvedValue(buildCategory({ name: "Bakery Updated" }));
    await repo.update("category-1", input as any);
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "category-1" },
      data: input,
    });
  });

  describe("unique-violation translation", () => {
    it("create translates a P2002 into a ConflictError", async () => {
      prisma.category.create.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.create({ shopId: "shop-1", name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("A category with this name already exists for this shop"),
      );
    });

    it("update translates a P2002 into a ConflictError", async () => {
      prisma.category.update.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.update("category-1", { name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("A category with this name already exists for this shop"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.category.create.mockRejectedValue(error);
      await expect(repo.create({ shopId: "shop-1", name: "X" } as any)).rejects.toThrow(error);
    });

    it("rethrows non-P2002 errors from update", async () => {
      const error = new Error("database down");
      prisma.category.update.mockRejectedValue(error);
      await expect(repo.update("category-1", { name: "X" } as any)).rejects.toThrow(error);
    });
  });
});
