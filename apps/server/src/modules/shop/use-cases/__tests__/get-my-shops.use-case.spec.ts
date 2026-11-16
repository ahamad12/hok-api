import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { GetMyShopsUseCase } from "../get-my-shops.use-case";

describe("GetMyShopsUseCase", () => {
  let shopRepository: {
    findByOwner: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let useCase: GetMyShopsUseCase;

  beforeEach(() => {
    shopRepository = { findByOwner: vi.fn(), findById: vi.fn() };
    useCase = new GetMyShopsUseCase(shopRepository as any);
  });

  describe("OWNER", () => {
    it("lists the tenant's shops by tenantId", async () => {
      shopRepository.findByOwner.mockResolvedValue([]);
      await useCase.execute({ role: UserRole.OWNER, tenantId: "owner-1", shopId: null });
      expect(shopRepository.findByOwner).toHaveBeenCalledWith("owner-1");
      expect(shopRepository.findById).not.toHaveBeenCalled();
    });

    it("returns an empty shops array when the owner has none", async () => {
      shopRepository.findByOwner.mockResolvedValue([]);
      const result = await useCase.execute({
        role: UserRole.OWNER,
        tenantId: "owner-1",
        shopId: null,
      });
      expect(result).toEqual({ shops: [] });
    });

    it("maps every returned shop through toShopResult, keeping repository order", async () => {
      shopRepository.findByOwner.mockResolvedValue([
        buildShop({ id: "shop-1" }),
        buildShop({ id: "shop-2" }),
      ]);
      const result = await useCase.execute({
        role: UserRole.OWNER,
        tenantId: "owner-1",
        shopId: null,
      });
      expect(result.shops.map((s) => s.id)).toEqual(["shop-1", "shop-2"]);
    });
  });

  describe("MANAGER", () => {
    it("lists the shops of their owner (tenantId), not their own user id", async () => {
      shopRepository.findByOwner.mockResolvedValue([buildShop({ id: "shop-1" })]);
      const result = await useCase.execute({
        role: UserRole.MANAGER,
        tenantId: "owner-1",
        shopId: null,
      });
      expect(shopRepository.findByOwner).toHaveBeenCalledWith("owner-1");
      expect(result.shops.map((s) => s.id)).toEqual(["shop-1"]);
    });

    it("returns no shops and skips the query when the manager has no tenant", async () => {
      const result = await useCase.execute({
        role: UserRole.MANAGER,
        tenantId: null,
        shopId: null,
      });
      expect(result).toEqual({ shops: [] });
      expect(shopRepository.findByOwner).not.toHaveBeenCalled();
    });
  });

  describe("STAFF", () => {
    it("returns only their own shop when it is active", async () => {
      shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-9", isActive: true }));
      const result = await useCase.execute({
        role: UserRole.STAFF,
        tenantId: "owner-1",
        shopId: "shop-9",
      });
      expect(shopRepository.findById).toHaveBeenCalledWith("shop-9");
      expect(shopRepository.findByOwner).not.toHaveBeenCalled();
      expect(result.shops.map((s) => s.id)).toEqual(["shop-9"]);
    });

    it("returns no shops when the staff member has no shop", async () => {
      const result = await useCase.execute({
        role: UserRole.STAFF,
        tenantId: "owner-1",
        shopId: null,
      });
      expect(result).toEqual({ shops: [] });
      expect(shopRepository.findById).not.toHaveBeenCalled();
    });

    it("returns no shops when their shop has been soft-deleted", async () => {
      shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-9", isActive: false }));
      const result = await useCase.execute({
        role: UserRole.STAFF,
        tenantId: "owner-1",
        shopId: "shop-9",
      });
      expect(result).toEqual({ shops: [] });
    });

    it("returns no shops when their shop no longer exists", async () => {
      shopRepository.findById.mockResolvedValue(null);
      const result = await useCase.execute({
        role: UserRole.STAFF,
        tenantId: "owner-1",
        shopId: "shop-9",
      });
      expect(result).toEqual({ shops: [] });
    });
  });
});
