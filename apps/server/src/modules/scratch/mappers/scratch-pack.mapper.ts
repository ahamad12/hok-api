import type { ScratchPack } from "@tapt-api/db";

export type ScratchPackResult = Pick<
  ScratchPack,
  | "id"
  | "gameId"
  | "shopId"
  | "serialStart"
  | "status"
  | "location"
  | "receivedById"
  | "receivedAt"
  | "finishedAt"
  | "returnedAt"
  | "createdAt"
  | "updatedAt"
>;

export function toScratchPackResult(pack: ScratchPack): ScratchPackResult {
  const {
    id,
    gameId,
    shopId,
    serialStart,
    status,
    location,
    receivedById,
    receivedAt,
    finishedAt,
    returnedAt,
    createdAt,
    updatedAt,
  } = pack;
  return {
    id,
    gameId,
    shopId,
    serialStart,
    status,
    location,
    receivedById,
    receivedAt,
    finishedAt,
    returnedAt,
    createdAt,
    updatedAt,
  };
}
