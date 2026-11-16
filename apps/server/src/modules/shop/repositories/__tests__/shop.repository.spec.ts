import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import {
  buildNotFoundError,
  buildUniqueViolationError,
} from "../../../../test/fixtures/prisma-error.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import {
  createPrismaServiceMock,
  type PrismaServiceMock,
} from "../../../../test/mocks/prisma.service.mock";
import { ShopRepository } from "../shop.repository";

describe("ShopRepository", () => {
  let prisma: PrismaServiceMock;
  let repo: ShopRepository;

  beforeEach(() => {
    prisma = createPrismaServiceMock();
    repo = new ShopRepository(prisma as any);
  });

  it("findById delegates to prisma.shop.findUnique", async () => {
    const shop = buildShop();
    prisma.shop.findUnique.mockResolvedValue(shop);
    await expect(repo.findById("shop-1")).resolves.toEqual(shop);
    expect(prisma.shop.findUnique).toHaveBeenCalledWith({ where: { id: "shop-1" } });
  });

  it("findById returns null when no shop matches", async () => {
    prisma.shop.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("findByOwner filters by ownerId AND isActive true, ordered by name", async () => {
    const shops = [buildShop()];
    prisma.shop.findMany.mockResolvedValue(shops);
    await repo.findByOwner("owner-1");
    expect(prisma.shop.findMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1", isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("findByOwner returns an empty array when the owner has no shops", async () => {
    prisma.shop.findMany.mockResolvedValue([]);
    await expect(repo.findByOwner("owner-with-nothing")).resolves.toEqual([]);
  });

  it("create delegates to prisma.shop.create with the given data", async () => {
    const input = {
      name: "New Shop",
      ownerId: "owner-1",
      address: {},
      phone: "123",
      isActive: true,
    };
    prisma.shop.create.mockResolvedValue(buildShop(input as any));
    await repo.create(input as any);
    expect(prisma.shop.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.shop.update scoped by id", async () => {
    prisma.shop.update.mockResolvedValue(buildShop());
    await repo.update("shop-1", { name: "Renamed" });
    expect(prisma.shop.update).toHaveBeenCalledWith({
      where: { id: "shop-1" },
      data: { name: "Renamed" },
    });
  });

  describe("softDelete", () => {
    it("sets isActive to false via update, not an actual delete", async () => {
      prisma.shop.update.mockResolvedValue(buildShop({ isActive: false }));
      await repo.softDelete("shop-1");
      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { id: "shop-1" },
        data: { isActive: false },
      });
    });

    it("does not call any delete method", async () => {
      prisma.shop.update.mockResolvedValue(buildShop());
      await repo.softDelete("shop-1");
      expect((prisma.shop as any).delete).toBeUndefined();
    });
  });

  describe("unique-violation translation", () => {
    it("create translates a P2002 into a ConflictError", async () => {
      prisma.shop.create.mockRejectedValue(buildUniqueViolationError(["ownerId_name"]));
      await expect(repo.create({ name: "Dup", ownerId: "owner-1" } as any)).rejects.toThrow(
        new ConflictError("You already have a shop with this name"),
      );
    });

    it("update translates a P2002 into a ConflictError", async () => {
      prisma.shop.update.mockRejectedValue(buildUniqueViolationError(["ownerId_name"]));
      await expect(repo.update("shop-1", { name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("You already have a shop with this name"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.shop.create.mockRejectedValue(error);
      await expect(repo.create({ name: "X", ownerId: "owner-1" } as any)).rejects.toThrow(error);
    });

    it("rethrows non-P2002 errors from update", async () => {
      const error = new Error("database down");
      prisma.shop.update.mockRejectedValue(error);
      await expect(repo.update("shop-1", { name: "X" } as any)).rejects.toThrow(error);
    });
  });

  describe("not-found translation", () => {
    it("softDelete translates P2025 into NotFoundError", async () => {
      prisma.shop.update.mockRejectedValue(buildNotFoundError());
      await expect(repo.softDelete("missing")).rejects.toThrow(
        new NotFoundError("Shop", "missing"),
      );
    });

    it("softDelete rethrows non-P2025 errors", async () => {
      const error = new Error("database down");
      prisma.shop.update.mockRejectedValue(error);
      await expect(repo.softDelete("shop-1")).rejects.toThrow(error);
    });
  });
});
