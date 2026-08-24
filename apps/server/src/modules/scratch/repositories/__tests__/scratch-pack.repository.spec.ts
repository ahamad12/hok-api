// modules/scratch/repositories/__tests__/scratch-pack.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { ScratchPackRepository } from "../scratch-pack.repository";

describe("ScratchPackRepository", () => {
  let prisma: any;
  let repo: ScratchPackRepository;

  beforeEach(() => {
    prisma = {
      scratchPack: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    repo = new ScratchPackRepository(prisma);
  });

  it("findAll applies shopId, gameId, status, and location filters together", async () => {
    prisma.scratchPack.findMany.mockResolvedValue([]);
    prisma.scratchPack.count.mockResolvedValue(0);
    await repo.findAll(
      { shopId: "shop-1", gameId: "game-1", status: "ACTIVE", location: "DISPLAY" },
      { limit: 20, offset: 0 },
    );
    expect(prisma.scratchPack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: "shop-1", gameId: "game-1", status: "ACTIVE", location: "DISPLAY" },
      }),
    );
  });

  it("findAll returns packs alongside the total count", async () => {
    const packs = [buildScratchPack()];
    prisma.scratchPack.findMany.mockResolvedValue(packs);
    prisma.scratchPack.count.mockResolvedValue(1);
    await expect(repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 0 })).resolves.toEqual({
      packs,
      total: 1,
    });
  });

  it("updateLocationIfActive guards on ACTIVE, updates the location, and returns the refreshed pack", async () => {
    const updated = buildScratchPack({ location: "BACKSTOCK" });
    prisma.scratchPack.updateMany.mockResolvedValue({ count: 1 });
    prisma.scratchPack.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await repo.updateLocationIfActive("pack-1", "BACKSTOCK");

    expect(prisma.scratchPack.updateMany).toHaveBeenCalledWith({
      where: { id: "pack-1", status: "ACTIVE" },
      data: { location: "BACKSTOCK" },
    });
    expect(prisma.scratchPack.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "pack-1" } });
    expect(result).toBe(updated);
  });

  it("updateLocationIfActive throws BusinessRuleError when the ACTIVE guard affects 0 rows", async () => {
    prisma.scratchPack.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.updateLocationIfActive("pack-1", "BACKSTOCK")).rejects.toThrow(
      BusinessRuleError,
    );
    expect(prisma.scratchPack.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("updateStatusIfActive passes status plus any provided timestamp fields through the ACTIVE guard", async () => {
    const finishedAt = new Date("2026-07-30T12:00:00.000Z");
    const updated = buildScratchPack({ status: "FINISHED", finishedAt });
    prisma.scratchPack.updateMany.mockResolvedValue({ count: 1 });
    prisma.scratchPack.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await repo.updateStatusIfActive("pack-1", { status: "FINISHED", finishedAt });

    expect(prisma.scratchPack.updateMany).toHaveBeenCalledWith({
      where: { id: "pack-1", status: "ACTIVE" },
      data: { status: "FINISHED", finishedAt },
    });
    expect(result).toBe(updated);
  });

  it("updateStatusIfActive throws BusinessRuleError when the ACTIVE guard affects 0 rows", async () => {
    prisma.scratchPack.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.updateStatusIfActive("pack-1", { status: "FINISHED" })).rejects.toThrow(
      BusinessRuleError,
    );
    expect(prisma.scratchPack.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  describe("unique-violation translation", () => {
    it("create translates a P2002 into a ConflictError", async () => {
      prisma.scratchPack.create.mockRejectedValue(
        buildUniqueViolationError(["gameId_serialStart"]),
      );
      await expect(
        repo.create({
          gameId: "game-1",
          shopId: "shop-1",
          serialStart: "000",
          status: "ACTIVE",
          location: "DISPLAY",
          receivedById: "staff-1",
          receivedAt: new Date(),
        }),
      ).rejects.toThrow(
        new ConflictError("A pack with this serial start has already been received for this game"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.scratchPack.create.mockRejectedValue(error);
      await expect(
        repo.create({
          gameId: "game-1",
          shopId: "shop-1",
          serialStart: "000",
          status: "ACTIVE",
          location: "DISPLAY",
          receivedById: "staff-1",
          receivedAt: new Date(),
        }),
      ).rejects.toThrow(error);
    });
  });
});
