// repositories/__tests__/category.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
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
});
