// modules/expense-category/repositories/__tests__/expense-category.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import {
  buildNotFoundError,
  buildUniqueViolationError,
} from "../../../../test/fixtures/prisma-error.fixture";
import { ExpenseCategoryRepository } from "../expense-category.repository";

describe("ExpenseCategoryRepository", () => {
  let prisma: any;
  let repo: ExpenseCategoryRepository;

  beforeEach(() => {
    prisma = {
      expenseCategory: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    repo = new ExpenseCategoryRepository(prisma);
  });

  describe("findById / findByIdOrThrow", () => {
    it("findById delegates to prisma.expenseCategory.findUnique", async () => {
      const category = buildExpenseCategory();
      prisma.expenseCategory.findUnique.mockResolvedValue(category);
      await expect(repo.findById("expense-category-1")).resolves.toEqual(category);
      expect(prisma.expenseCategory.findUnique).toHaveBeenCalledWith({
        where: { id: "expense-category-1" },
      });
    });

    it("findByIdOrThrow throws NotFoundError when the category doesn't exist", async () => {
      prisma.expenseCategory.findUnique.mockResolvedValue(null);
      await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
    });

    it("findByIdOrThrow returns the category when found", async () => {
      const category = buildExpenseCategory();
      prisma.expenseCategory.findUnique.mockResolvedValue(category);
      await expect(repo.findByIdOrThrow("expense-category-1")).resolves.toEqual(category);
    });
  });

  describe("findAllGlobalAndShop", () => {
    it("queries with an OR across null shopId and the given shopId", async () => {
      prisma.expenseCategory.findMany.mockResolvedValue([]);
      await repo.findAllGlobalAndShop("shop-1");
      expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
        where: { OR: [{ shopId: null }, { shopId: "shop-1" }] },
        orderBy: { name: "asc" },
      });
    });

    it("includes isActive in the where clause when given", async () => {
      prisma.expenseCategory.findMany.mockResolvedValue([]);
      await repo.findAllGlobalAndShop("shop-1", true);
      expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
        where: { OR: [{ shopId: null }, { shopId: "shop-1" }], isActive: true },
        orderBy: { name: "asc" },
      });
    });

    it("omits isActive from the where clause when not given", async () => {
      prisma.expenseCategory.findMany.mockResolvedValue([]);
      await repo.findAllGlobalAndShop("shop-1");
      const call = prisma.expenseCategory.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("isActive");
    });

    it("returns both global and shop-specific categories together", async () => {
      const global = buildExpenseCategory({ id: "global-1", shopId: null });
      const shopSpecific = buildExpenseCategory({ id: "shop-1-cat", shopId: "shop-1" });
      prisma.expenseCategory.findMany.mockResolvedValue([global, shopSpecific]);
      const result = await repo.findAllGlobalAndShop("shop-1");
      expect(result).toEqual([global, shopSpecific]);
    });
  });

  describe("create", () => {
    it("delegates to prisma.expenseCategory.create with the given data", async () => {
      const input = { shopId: "shop-1", name: "Utilities", description: null, isActive: true };
      prisma.expenseCategory.create.mockResolvedValue(buildExpenseCategory());
      await repo.create(input as any);
      expect(prisma.expenseCategory.create).toHaveBeenCalledWith({ data: input });
    });

    it("supports shopId: null for a global category", async () => {
      const input = { shopId: null, name: "Global Utilities", description: null, isActive: true };
      prisma.expenseCategory.create.mockResolvedValue(buildExpenseCategory({ shopId: null }));
      await repo.create(input as any);
      expect(prisma.expenseCategory.create).toHaveBeenCalledWith({ data: input });
    });

    it("translates a unique violation into a ConflictError", async () => {
      prisma.expenseCategory.create.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.create({ shopId: "shop-1", name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("An expense category with this name already exists"),
      );
    });

    it("rethrows non-unique-violation errors from create", async () => {
      const error = new Error("database down");
      prisma.expenseCategory.create.mockRejectedValue(error);
      await expect(repo.create({ shopId: "shop-1", name: "X" } as any)).rejects.toThrow(error);
    });
  });

  describe("update", () => {
    it("delegates to prisma.expenseCategory.update with the given id and data", async () => {
      const input = { name: "Renamed" };
      prisma.expenseCategory.update.mockResolvedValue(buildExpenseCategory({ name: "Renamed" }));
      await repo.update("expense-category-1", input as any);
      expect(prisma.expenseCategory.update).toHaveBeenCalledWith({
        where: { id: "expense-category-1" },
        data: input,
      });
    });

    it("translates a unique violation into a ConflictError", async () => {
      prisma.expenseCategory.update.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.update("expense-category-1", { name: "Dup" } as any)).rejects.toThrow(
        ConflictError,
      );
    });

    it("translates a not-found error into NotFoundError", async () => {
      prisma.expenseCategory.update.mockRejectedValue(buildNotFoundError());
      await expect(repo.update("missing", { name: "X" } as any)).rejects.toThrow(NotFoundError);
    });

    it("rethrows other errors unchanged", async () => {
      const error = new Error("database down");
      prisma.expenseCategory.update.mockRejectedValue(error);
      await expect(repo.update("expense-category-1", { name: "X" } as any)).rejects.toThrow(error);
    });
  });
});
