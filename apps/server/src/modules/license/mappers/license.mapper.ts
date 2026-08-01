// modules/license/mappers/license.mapper.ts
import type { License } from "@tapt-api/db";

export type LicenseResult = Pick<
  License,
  | "id"
  | "shopId"
  | "productName"
  | "licenseNumber"
  | "remindDays"
  | "isActive"
  | "currentIssueDate"
  | "currentExpiryDate"
  | "createdAt"
  | "updatedAt"
> & {
  daysRemaining: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
};

export function toLicenseResult(license: License, asOf: Date = new Date()): LicenseResult {
  const {
    id,
    shopId,
    productName,
    licenseNumber,
    remindDays,
    isActive,
    currentIssueDate,
    currentExpiryDate,
    createdAt,
    updatedAt,
  } = license;

  let daysRemaining: number | null = null;
  let isExpired = false;
  let isExpiringSoon = false;

  if (currentExpiryDate) {
    daysRemaining = Math.ceil((currentExpiryDate.getTime() - asOf.getTime()) / 86_400_000);
    isExpired = daysRemaining < 0;
    isExpiringSoon = !isExpired && daysRemaining <= remindDays;
  }

  return {
    id,
    shopId,
    productName,
    licenseNumber,
    remindDays,
    isActive,
    currentIssueDate,
    currentExpiryDate,
    createdAt,
    updatedAt,
    daysRemaining,
    isExpired,
    isExpiringSoon,
  };
}
