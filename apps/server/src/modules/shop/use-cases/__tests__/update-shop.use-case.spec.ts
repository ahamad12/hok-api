import { Prisma } from "@tapt-api/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { UpdateShopUseCase } from "../update-shop.use-case";

function buildP2002Error(target: string[] = ["name"]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("UpdateShopUseCase", () => {
  let shopRepository: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateShopUseCase;

  beforeEach(() => {
    shopRepository = { findById: vi.fn(), update: vi.fn() };
    useCase = new UpdateShopUseCase(shopRepository as any);

    shopRepository.findById.mockResolvedValue(
      buildShop({ id: "shop-1", ownerId: "owner-1", name: "Old Name" }),
    );
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

  it("does not pre-check name uniqueness before updating — goes straight to update", async () => {
    await useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "New Name" });
    expect(shopRepository.update).toHaveBeenCalledTimes(1);
  });

  it("translates a P2002 on update into a ConflictError", async () => {
    shopRepository.update.mockRejectedValue(buildP2002Error());
    await expect(
      useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "Taken Name" }),
    ).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from update", async () => {
    const error = new Error("database down");
    shopRepository.update.mockRejectedValue(error);
    await expect(
      useCase.execute({ requesterId: "owner-1", shopId: "shop-1", name: "New Name" }),
    ).rejects.toThrow(error);
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
