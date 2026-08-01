import { describe, expect, it } from "vitest";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { toLicenseResult } from "../license.mapper";

describe("toLicenseResult", () => {
  it("maps all base fields from the Prisma row", () => {
    const license = buildLicense();
    const result = toLicenseResult(license);
    expect(result).toMatchObject({
      id: license.id,
      shopId: license.shopId,
      productName: license.productName,
      licenseNumber: license.licenseNumber,
      remindDays: license.remindDays,
      isActive: license.isActive,
      currentIssueDate: license.currentIssueDate,
      currentExpiryDate: license.currentExpiryDate,
      createdAt: license.createdAt,
      updatedAt: license.updatedAt,
    });
  });

  it("computes daysRemaining as null when currentExpiryDate is null", () => {
    const license = buildLicense({
      currentExpiryDate: null,
      currentIssueDate: null,
      currentRenewalId: null,
    });
    const result = toLicenseResult(license);
    expect(result.daysRemaining).toBeNull();
    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(false);
  });

  it("computes a positive daysRemaining for a future expiry, not yet expiring soon", () => {
    const asOf = new Date("2026-01-01T00:00:00.000Z");
    const license = buildLicense({
      remindDays: 7,
      currentExpiryDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const result = toLicenseResult(license, asOf);
    expect(result.daysRemaining).toBe(31);
    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(false);
  });

  it("flags isExpiringSoon when daysRemaining falls inside remindDays, inclusive", () => {
    const asOf = new Date("2026-01-01T00:00:00.000Z");
    const license = buildLicense({
      remindDays: 7,
      currentExpiryDate: new Date("2026-01-08T00:00:00.000Z"),
    }); // exactly 7 days out
    const result = toLicenseResult(license, asOf);
    expect(result.daysRemaining).toBe(7);
    expect(result.isExpiringSoon).toBe(true);
    expect(result.isExpired).toBe(false);
  });

  it("does not flag isExpiringSoon one day outside the remindDays window", () => {
    const asOf = new Date("2026-01-01T00:00:00.000Z");
    const license = buildLicense({
      remindDays: 7,
      currentExpiryDate: new Date("2026-01-09T00:00:00.000Z"),
    }); // 8 days out
    const result = toLicenseResult(license, asOf);
    expect(result.isExpiringSoon).toBe(false);
  });

  it("flags isExpired and NOT isExpiringSoon once the expiry date has passed", () => {
    const asOf = new Date("2026-01-10T00:00:00.000Z");
    const license = buildLicense({
      remindDays: 7,
      currentExpiryDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    const result = toLicenseResult(license, asOf);
    expect(result.isExpired).toBe(true);
    expect(result.isExpiringSoon).toBe(false);
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it("does not leak any field beyond the documented result shape", () => {
    const result = toLicenseResult(buildLicense());
    expect(Object.keys(result).sort()).toEqual(
      [
        "createdAt",
        "currentExpiryDate",
        "currentIssueDate",
        "daysRemaining",
        "id",
        "isActive",
        "isExpired",
        "isExpiringSoon",
        "licenseNumber",
        "productName",
        "remindDays",
        "shopId",
        "updatedAt",
      ].sort(),
    );
  });
});
