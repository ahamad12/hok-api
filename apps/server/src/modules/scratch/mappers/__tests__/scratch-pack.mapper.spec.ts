// modules/scratch/mappers/__tests__/scratch-pack.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildScratchPack } from "../../../../test/fixtures/scratch.fixture";
import { toScratchPackResult } from "../scratch-pack.mapper";

describe("toScratchPackResult", () => {
  it("maps all whitelisted fields", () => {
    const pack = buildScratchPack();
    expect(toScratchPackResult(pack)).toEqual({
      id: pack.id,
      gameId: pack.gameId,
      shopId: pack.shopId,
      serialStart: pack.serialStart,
      status: pack.status,
      location: pack.location,
      receivedById: pack.receivedById,
      receivedAt: pack.receivedAt,
      finishedAt: pack.finishedAt,
      returnedAt: pack.returnedAt,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
    });
  });

  it("does not leak any field beyond the whitelisted set", () => {
    expect(Object.keys(toScratchPackResult(buildScratchPack())).sort()).toEqual(
      [
        "createdAt",
        "finishedAt",
        "gameId",
        "id",
        "location",
        "receivedAt",
        "receivedById",
        "returnedAt",
        "serialStart",
        "shopId",
        "status",
        "updatedAt",
      ].sort(),
    );
  });

  it("preserves null finishedAt/returnedAt rather than coercing them", () => {
    const pack = buildScratchPack({ finishedAt: null, returnedAt: null });
    const result = toScratchPackResult(pack);
    expect(result.finishedAt).toBeNull();
    expect(result.returnedAt).toBeNull();
  });
});
