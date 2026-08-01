import type { License } from "@tapt-api/db";

export function buildLicense(overrides: Partial<License> = {}): License {
  return {
    id: "license-1",
    shopId: "shop-1",
    productName: "Tobacco Retail License",
    licenseNumber: "TB-2026-001",
    remindDays: 7,
    isActive: true,
    currentRenewalId: "renewal-1",
    currentIssueDate: new Date("2026-01-01"),
    currentExpiryDate: new Date("2027-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as License;
}
