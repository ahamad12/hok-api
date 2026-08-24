// modules/supplier/repositories/__tests__/supplier.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { SupplierRepository } from "../supplier.repository";

describe("SupplierRepository", () => {
  let prisma: any;
  let repo: SupplierRepository;

  beforeEach(() => {
    prisma = {
      supplier: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    repo = new SupplierRepository(prisma);
  });

  it("findById delegates to prisma.supplier.findUnique", async () => {
    const supplier = buildSupplier();
    prisma.supplier.findUnique.mockResolvedValue(supplier);
    await expect(repo.findById("supplier-1")).resolves.toEqual(supplier);
    expect(prisma.supplier.findUnique).toHaveBeenCalledWith({ where: { id: "supplier-1" } });
  });

  it("returns null when no supplier matches", async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("findAll applies shopId, categoryId, and isActive filters", async () => {
    prisma.supplier.findMany.mockResolvedValue([]);
    await repo.findAll("shop-1", { categoryId: "cat-1", isActive: true });
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1", categoryId: "cat-1", isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("create delegates to prisma.supplier.create", async () => {
    const input = {
      shopId: "shop-1",
      categoryId: "cat-1",
      name: "Fresh Foods",
      isActive: true,
    };
    prisma.supplier.create.mockResolvedValue(buildSupplier(input as any));
    await repo.create(input as any);
    expect(prisma.supplier.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.supplier.update scoped by id", async () => {
    const patch = { name: "Renamed" };
    prisma.supplier.update.mockResolvedValue(buildSupplier(patch as any));
    await repo.update("supplier-1", patch as any);
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: "supplier-1" },
      data: patch,
    });
  });

  describe("unique-violation translation", () => {
    it("create translates a P2002 into a ConflictError", async () => {
      prisma.supplier.create.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(
        repo.create({ shopId: "shop-1", categoryId: "cat-1", name: "Dup" } as any),
      ).rejects.toThrow(
        new ConflictError("A supplier with this name already exists for this shop"),
      );
    });

    it("update translates a P2002 into a ConflictError", async () => {
      prisma.supplier.update.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.update("supplier-1", { name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("A supplier with this name already exists for this shop"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.supplier.create.mockRejectedValue(error);
      await expect(
        repo.create({ shopId: "shop-1", categoryId: "cat-1", name: "X" } as any),
      ).rejects.toThrow(error);
    });

    it("rethrows non-P2002 errors from update", async () => {
      const error = new Error("database down");
      prisma.supplier.update.mockRejectedValue(error);
      await expect(repo.update("supplier-1", { name: "X" } as any)).rejects.toThrow(error);
    });
  });
});
