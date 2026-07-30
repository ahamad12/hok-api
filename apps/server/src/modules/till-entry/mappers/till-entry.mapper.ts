import type { TillEntry } from "@tapt-api/db";

export type TillEntryResult = Pick<
  TillEntry,
  | "id"
  | "shopId"
  | "category"
  | "amount"
  | "description"
  | "billUrl"
  | "recordedById"
  | "transactionDate"
  | "reversesEntryId"
  | "correctionReason"
  | "createdAt"
>;

export function toTillEntryResult(entry: TillEntry): TillEntryResult {
  const {
    id,
    shopId,
    category,
    amount,
    description,
    billUrl,
    recordedById,
    transactionDate,
    reversesEntryId,
    correctionReason,
    createdAt,
  } = entry;
  return {
    id,
    shopId,
    category,
    amount,
    description,
    billUrl,
    recordedById,
    transactionDate,
    reversesEntryId,
    correctionReason,
    createdAt,
  };
}
