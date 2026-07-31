// modules/scratch/mappers/__tests__/scratch-game.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildScratchGame } from "../../../../test/fixtures/scratch.fixture";
import { toScratchGameResult } from "../scratch-game.mapper";

describe("toScratchGameResult", () => {
  it("maps all whitelisted fields", () => {
    const game = buildScratchGame();
    expect(toScratchGameResult(game)).toEqual({
      id: game.id,
      shopId: game.shopId,
      gameNumber: game.gameNumber,
      name: game.name,
      priceCents: game.priceCents,
      ticketsPerPack: game.ticketsPerPack,
      isActive: game.isActive,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    });
  });

  it("does not leak any field beyond the whitelisted set", () => {
    expect(Object.keys(toScratchGameResult(buildScratchGame())).sort()).toEqual(
      [
        "createdAt",
        "gameNumber",
        "id",
        "isActive",
        "name",
        "priceCents",
        "shopId",
        "ticketsPerPack",
        "updatedAt",
      ].sort(),
    );
  });
});
