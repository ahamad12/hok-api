import { describe, expect, it } from "vitest";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { toLicenseRenewalResult } from "../license-renewal.mapper";

describe("toLicenseRenewalResult", () => {
  it("maps all fields from the Prisma row", () => {
    const renewal = buildLicenseRenewal();
    expect(toLicenseRenewalResult(renewal)).toEqual({
      id: renewal.id,
      licenseId: renewal.licenseId,
      source: renewal.source,
      issueDate: renewal.issueDate,
      expiryDate: renewal.expiryDate,
      paymentAmount: renewal.paymentAmount,
      paymentDate: renewal.paymentDate,
      documentUrl: renewal.documentUrl,
      notes: renewal.notes,
      recordedById: renewal.recordedById,
      voidedAt: renewal.voidedAt,
      voidedById: renewal.voidedById,
      voidReason: renewal.voidReason,
      createdAt: renewal.createdAt,
    });
  });

  it("preserves voided-row fields rather than stripping them", () => {
    const voided = buildLicenseRenewal({
      voidedAt: new Date("2026-03-01"),
      voidedById: "manager-1",
      voidReason: "Wrong expiry entered",
    });
    const result = toLicenseRenewalResult(voided);
    expect(result.voidedAt).toEqual(new Date("2026-03-01"));
    expect(result.voidedById).toBe("manager-1");
    expect(result.voidReason).toBe("Wrong expiry entered");
  });

  it("does not leak any field beyond the whitelisted set", () => {
    const result = toLicenseRenewalResult(buildLicenseRenewal());
    expect(Object.keys(result).sort()).toEqual(
      [
        "createdAt",
        "documentUrl",
        "expiryDate",
        "id",
        "issueDate",
        "licenseId",
        "notes",
        "paymentAmount",
        "paymentDate",
        "recordedById",
        "source",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });
});
