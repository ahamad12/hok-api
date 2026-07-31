import type { ScratchGame } from "@tapt-api/db";

export type ScratchGameResult = Pick<
  ScratchGame,
  | "id"
  | "shopId"
  | "gameNumber"
  | "name"
  | "priceCents"
  | "ticketsPerPack"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>;

export function toScratchGameResult(game: ScratchGame): ScratchGameResult {
  const {
    id,
    shopId,
    gameNumber,
    name,
    priceCents,
    ticketsPerPack,
    isActive,
    createdAt,
    updatedAt,
  } = game;
  return {
    id,
    shopId,
    gameNumber,
    name,
    priceCents,
    ticketsPerPack,
    isActive,
    createdAt,
    updatedAt,
  };
}
