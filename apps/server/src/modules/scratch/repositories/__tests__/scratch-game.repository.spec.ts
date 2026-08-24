// modules/scratch/repositories/__tests__/scratch-game.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildScratchGame } from "../../../../test/fixtures/scratch.fixture";
import { ScratchGameRepository } from "../scratch-game.repository";

describe("ScratchGameRepository", () => {
  let prisma: any;
  let repo: ScratchGameRepository;

  beforeEach(() => {
    prisma = {
      scratchGame: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    repo = new ScratchGameRepository(prisma);
  });

  it("findById delegates to prisma.scratchGame.findUnique", async () => {
    const game = buildScratchGame();
    prisma.scratchGame.findUnique.mockResolvedValue(game);
    await expect(repo.findById("game-1")).resolves.toEqual(game);
    expect(prisma.scratchGame.findUnique).toHaveBeenCalledWith({ where: { id: "game-1" } });
  });

  it("findAll scopes by shopId and applies isActive when given", async () => {
    prisma.scratchGame.findMany.mockResolvedValue([]);
    await repo.findAll({ shopId: "shop-1", isActive: true });
    expect(prisma.scratchGame.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1", isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("findAll omits isActive from the where clause when not given", async () => {
    prisma.scratchGame.findMany.mockResolvedValue([]);
    await repo.findAll({ shopId: "shop-1" });
    expect(prisma.scratchGame.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop-1" },
      orderBy: { name: "asc" },
    });
  });

  it("create delegates to prisma.scratchGame.create with the given data", async () => {
    const input = {
      shopId: "shop-1",
      gameNumber: "123",
      name: "Lucky 7s",
      priceCents: 500,
      ticketsPerPack: 30,
    };
    prisma.scratchGame.create.mockResolvedValue(buildScratchGame());
    await repo.create(input as any);
    expect(prisma.scratchGame.create).toHaveBeenCalledWith({ data: input });
  });

  describe("unique-violation translation", () => {
    it("create translates a P2002 into a ConflictError", async () => {
      prisma.scratchGame.create.mockRejectedValue(buildUniqueViolationError(["shopId_name"]));
      await expect(repo.create({ shopId: "shop-1", name: "Dup" } as any)).rejects.toThrow(
        new ConflictError("A scratch game with this name already exists for this shop"),
      );
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.scratchGame.create.mockRejectedValue(error);
      await expect(repo.create({ shopId: "shop-1", name: "X" } as any)).rejects.toThrow(error);
    });
  });
});
