// modules/scratch/use-cases/__tests__/receive-scratch-pack.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildScratchGame, buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { ReceiveScratchPackUseCase } from "../receive-scratch-pack.use-case";

describe("ReceiveScratchPackUseCase", () => {
  let packRepo: {
    findByGameAndSerialStart: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
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
    packRepo = { findByGameAndSerialStart: vi.fn(), create: vi.fn() };
    gameRepo = { findById: vi.fn() };
    shopRepo = { findById: vi.fn() };
    useCase = new ReceiveScratchPackUseCase(packRepo as any, gameRepo as any, shopRepo as any);

    shopRepo.findById.mockResolvedValue(buildShop({ id: "shop-1", isActive: true }));
    gameRepo.findById.mockResolvedValue(buildScratchGame({ shopId: "shop-1", isActive: true }));
    packRepo.findByGameAndSerialStart.mockResolvedValue(null);
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

  it("throws ConflictError when this game + serialStart has already been received", async () => {
    packRepo.findByGameAndSerialStart.mockResolvedValue(buildScratchPack());
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });

  it("creates the pack as ACTIVE with the given location — no WAREHOUSE holding state", async () => {
    await useCase.execute(input);
    expect(packRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE", location: "DISPLAY", receivedById: "staff-1" }),
    );
  });
});
