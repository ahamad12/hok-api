// modules/scratch/repositories/__tests__/scratch-pack.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { ScratchPackRepository } from "../scratch-pack.repository";

describe("ScratchPackRepository", () => {
  let prisma: any;
  let repo: ScratchPackRepository;

  beforeEach(() => {
    prisma = {
      scratchPack: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    repo = new ScratchPackRepository(prisma);
  });

  it("findByGameAndSerialStart queries the compound unique key, not by id", async () => {
    prisma.scratchPack.findUnique.mockResolvedValue(null);
    await repo.findByGameAndSerialStart("game-1", "000");
    expect(prisma.scratchPack.findUnique).toHaveBeenCalledWith({
      where: { gameId_serialStart: { gameId: "game-1", serialStart: "000" } },
    });
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

  it("updateLocation updates only the location field", async () => {
    prisma.scratchPack.update.mockResolvedValue(buildScratchPack({ location: "BACKSTOCK" }));
    await repo.updateLocation("pack-1", "BACKSTOCK");
    expect(prisma.scratchPack.update).toHaveBeenCalledWith({
      where: { id: "pack-1" },
      data: { location: "BACKSTOCK" },
    });
  });

  it("updateStatus passes status plus any provided timestamp fields through as-is", async () => {
    const finishedAt = new Date("2026-07-30T12:00:00.000Z");
    prisma.scratchPack.update.mockResolvedValue(
      buildScratchPack({ status: "FINISHED", finishedAt }),
    );
    await repo.updateStatus("pack-1", { status: "FINISHED", finishedAt });
    expect(prisma.scratchPack.update).toHaveBeenCalledWith({
      where: { id: "pack-1" },
      data: { status: "FINISHED", finishedAt },
    });
  });
});
