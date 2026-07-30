import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { UpdateShopUseCase } from "../update-shop.use-case";

describe("UpdateShopUseCase", () => {
  let shopRepository: {
    findById: ReturnType<typeof vi.fn>;
    existsByNameForOwner: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateShopUseCase;

  beforeEach(() => {
    shopRepository = { findById: vi.fn(), existsByNameForOwner: vi.fn(), update: vi.fn() };
    useCase = new UpdateShopUseCase(shopRepository as any);

    shopRepository.findById.mockResolvedValue(
      buildShop({ id: "shop-1", ownerId: "owner-1", name: "Old Name" }),
    );
    shopRepository.existsByNameForOwner.mockResolvedValue(false);
    shopRepository.update.mockResolvedValue(buildShop({ id: "shop-1", name: "New Name" }));
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ requesterId: "owner-1", shopId: "missing", name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when the requester does not own the shop", async () => {
    await expect(
      useCase.execute({ requesterId: "someone-else", shopId: "shop-1", name: "X" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws ConflictError when renaming to a name the requester already uses elsewhere", async () => {
    shopRepository.existsByNameForOwner.mockResolvedValue(true);
    await expect(
      useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "Taken Name" }),
    ).rejects.toThrow(ConflictError);
  });

  it("does NOT check name uniqueness when the name is unchanged from the current value", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "Old Name" });
    expect(shopRepository.existsByNameForOwner).not.toHaveBeenCalled();
  });

  it("does NOT check name uniqueness when name is not part of the update at all", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", phone: "+94770000000" });
    expect(shopRepository.existsByNameForOwner).not.toHaveBeenCalled();
  });

  it("checks name uniqueness only when the name is actually changing", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "New Name" });
    expect(shopRepository.existsByNameForOwner).toHaveBeenCalledWith("New Name", "owner-1");
  });

  it("updates only the fields explicitly provided (partial update)", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", phone: "+94770000000" });
    expect(shopRepository.update).toHaveBeenCalledWith("shop-1", { phone: "+94770000000" });
  });

  it("allows isActive: false to pass through (reactivation/deactivation via update, distinct from delete)", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", isActive: false });
    expect(shopRepository.update).toHaveBeenCalledWith("shop-1", { isActive: false });
  });

  it("returns the mapped, updated shop", async () => {
    const result = await useCase.execute({
      requesterId: "owner-1",
      shopId: "shop-1",
      name: "New Name",
    });
    expect(result.name).toBe("New Name");
  });
});
