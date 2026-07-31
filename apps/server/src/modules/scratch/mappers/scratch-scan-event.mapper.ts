import type { ScratchScanEvent } from "@tapt-api/db";

export type ScratchScanEventResult = Pick<
  ScratchScanEvent,
  | "id"
  | "packId"
  | "gameId"
  | "shopId"
  | "scanDate"
  | "shiftPeriod"
  | "scannedSerial"
  | "ticketsSoldSincePrevious"
  | "ticketsRemaining"
  | "unitPriceCents"
  | "revenueCents"
  | "scannedById"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
>;

export function toScratchScanEventResult(scan: ScratchScanEvent): ScratchScanEventResult {
  const {
    id,
    packId,
    gameId,
    shopId,
    scanDate,
    shiftPeriod,
    scannedSerial,
    ticketsSoldSincePrevious,
    ticketsRemaining,
    unitPriceCents,
    revenueCents,
    scannedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  } = scan;
  return {
    id,
    packId,
    gameId,
    shopId,
    scanDate,
    shiftPeriod,
    scannedSerial,
    ticketsSoldSincePrevious,
    ticketsRemaining,
    unitPriceCents,
    revenueCents,
    scannedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  };
}
