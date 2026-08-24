// modules/scratch/use-cases/__tests__/receive-scratch-pack.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildScratchGame, buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { ReceiveScratchPackUseCase } from "../receive-scratch-pack.use-case";

describe("ReceiveScratchPackUseCase", () => {
  let packRepo: { create: ReturnType<typeof vi.fn> };
  let gameRepo: { findById: ReturnType<typeof vi.fn> };
  let shopRepo: { findById: ReturnType<typeof vi.fn> };
  let useCase: ReceiveScratchPackUseCase;

  const input = {
    requesterId: "staff-1",
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    shopId: "shop-1",
    gameId: "game-1",
    serialStart: "000",
    location: "DISPLAY" as const,
  };

  beforeEach(() => {
    packRepo = { create: vi.fn() };
    gameRepo = { findById: vi.fn() };
    shopRepo = { findById: vi.fn() };
    useCase = new ReceiveScratchPackUseCase(packRepo as any, gameRepo as any, shopRepo as any);

    shopRepo.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
    gameRepo.findById.mockResolvedValue(buildScratchGame({ shopId: "shop-1", isActive: true }));
    packRepo.create.mockResolvedValue(buildScratchPack());
  });

  it("throws AuthorizationError when STAFF receives for a different shop", async () => {
    await expect(useCase.execute({ ...input, requesterShopId: "other-shop" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER/MANAGER to receive for any shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.OWNER, requesterShopId: null }),
    ).resolves.toBeDefined();
  });

  it("throws NotFoundError when the shop does not exist or is inactive", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the game does not exist, belongs to a different shop, or is inactive", async () => {
    gameRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);

    gameRepo.findById.mockResolvedValue(buildScratchGame({ shopId: "other-shop" }));
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);

    gameRepo.findById.mockResolvedValue(buildScratchGame({ shopId: "shop-1", isActive: false }));
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("does not pre-check duplicate receipt — goes straight to create", async () => {
    await useCase.execute(input);
    expect(packRepo.create).toHaveBeenCalledTimes(1);
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    packRepo.create.mockRejectedValue(
      new ConflictError("A pack with this serial start has already been received for this game"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("rethrows non-P2002 errors from create", async () => {
    const error = new Error("database down");
    packRepo.create.mockRejectedValue(error);
    await expect(useCase.execute(input)).rejects.toThrow(error);
  });

  it("creates the pack as ACTIVE with the given location — no WAREHOUSE holding state", async () => {
    await useCase.execute(input);
    expect(packRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE", location: "DISPLAY", receivedById: "staff-1" }),
    );
  });
});
