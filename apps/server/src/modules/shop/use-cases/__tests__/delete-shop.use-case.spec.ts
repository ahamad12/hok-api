import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { DeleteShopUseCase } from "../delete-shop.use-case";

describe("DeleteShopUseCase", () => {
  let shopRepository: { findById: ReturnType<typeof vi.fn>; softDelete: ReturnType<typeof vi.fn> };
  let useCase: DeleteShopUseCase;

  beforeEach(() => {
    shopRepository = { findById: vi.fn(), softDelete: vi.fn().mockResolvedValue(undefined) };
    useCase = new DeleteShopUseCase(shopRepository as any);
    shopRepository.findById.mockResolvedValue(buildShop({ id: "shop-1", ownerId: "owner-1" }));
  });

  it("throws NotFoundError when the shop does not exist", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ requesterId: "owner-1", shopId: "missing" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws AuthorizationError (NOT NotFoundError) when a non-owner attempts to delete", async () => {
    await expect(
      useCase.execute({ requesterId: "not-the-owner", shopId: "shop-1" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("does not throw NotFoundError for the non-owner case specifically", async () => {
    let thrown: unknown;
    try {
      await useCase.execute({ requesterId: "not-the-owner", shopId: "shop-1" });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeInstanceOf(NotFoundError);
  });

  it("soft-deletes the shop when the requester is the owner", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1" });
    expect(shopRepository.softDelete).toHaveBeenCalledWith("shop-1");
  });

  it("returns a success message", async () => {
    const result = await useCase.execute({ requesterId: "owner-1", shopId: "shop-1" });
    expect(result).toEqual({ message: "Shop deactivated successfully" });
  });

  it("does not call softDelete when authorization fails", async () => {
    await expect(
      useCase.execute({ requesterId: "not-the-owner", shopId: "shop-1" }),
    ).rejects.toThrow();
    expect(shopRepository.softDelete).not.toHaveBeenCalled();
  });
});
