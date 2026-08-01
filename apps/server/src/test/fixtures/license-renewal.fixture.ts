import type { LicenseRenewal } from "@tapt-api/db";

export function buildLicenseRenewal(overrides: Partial<LicenseRenewal> = {}): LicenseRenewal {
  return {
    id: "renewal-1",
    licenseId: "license-1",
    source: "INITIAL",
    issueDate: new Date("2026-01-01"),
    expiryDate: new Date("2027-01-01"),
    paymentAmount: 5000,
    paymentDate: new Date("2026-01-01"),
    documentUrl: null,
    notes: null,
    recordedById: "owner-1",
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as LicenseRenewal;
}
