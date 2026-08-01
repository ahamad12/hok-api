// modules/license/mappers/license-renewal.mapper.ts
import type { LicenseRenewal } from "@tapt-api/db";

export type LicenseRenewalResult = Pick<
  LicenseRenewal,
  | "id"
  | "licenseId"
  | "source"
  | "issueDate"
  | "expiryDate"
  | "paymentAmount"
  | "paymentDate"
  | "documentUrl"
  | "notes"
  | "recordedById"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
>;

export function toLicenseRenewalResult(renewal: LicenseRenewal): LicenseRenewalResult {
  const {
    id,
    licenseId,
    source,
    issueDate,
    expiryDate,
    paymentAmount,
    paymentDate,
    documentUrl,
    notes,
    recordedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  } = renewal;
  return {
    id,
    licenseId,
    source,
    issueDate,
    expiryDate,
    paymentAmount,
    paymentDate,
    documentUrl,
    notes,
    recordedById,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  };
}
