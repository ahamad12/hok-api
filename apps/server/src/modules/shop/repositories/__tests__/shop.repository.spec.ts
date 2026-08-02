import { beforeEach, describe, expect, it } from "vitest";
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

  it("findByOwner filters by ownerId AND isActive true", async () => {
    const shops = [buildShop()];
    prisma.shop.findMany.mockResolvedValue(shops);
    await repo.findByOwner("owner-1");
    expect(prisma.shop.findMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1", isActive: true },
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
});
