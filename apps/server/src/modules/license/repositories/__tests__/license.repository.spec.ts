import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { LicenseRepository } from "../license.repository";

function buildPrismaMock() {
  return {
    license: {
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((arg: any) =>
      typeof arg === "function" ? Promise.resolve(arg(buildTx())) : Promise.all(arg),
    ),
  };
}

function buildTx() {
  return {
    license: { create: vi.fn(), update: vi.fn() },
    licenseRenewal: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  };
}

describe("LicenseRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: LicenseRepository;

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new LicenseRepository(prisma as any);
  });

  it("findById delegates to prisma.license.findUnique", async () => {
    const license = buildLicense();
    prisma.license.findUnique.mockResolvedValue(license);
    await expect(repo.findById("license-1")).resolves.toEqual(license);
    expect(prisma.license.findUnique).toHaveBeenCalledWith({ where: { id: "license-1" } });
  });

  it("findById returns null when no license matches", async () => {
    prisma.license.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("findAll scopes by shopId and applies the isActive filter when provided", async () => {
    prisma.license.findMany.mockResolvedValue([]);
    prisma.license.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1", isActive: true }, { limit: 20, offset: 0 });
    expect(prisma.license.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: "shop-1", isActive: true } }),
    );
  });

  it("findAll omits the isActive predicate entirely when not provided (not false)", async () => {
    prisma.license.findMany.mockResolvedValue([]);
    prisma.license.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1" }, { limit: 20, offset: 0 });
    const callArgs = prisma.license.findMany.mock.calls[0]![0];
    expect(callArgs.where).not.toHaveProperty("isActive");
  });

  it("findAll orders by currentExpiryDate ascending and applies pagination", async () => {
    prisma.license.findMany.mockResolvedValue([]);
    prisma.license.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 20 });
    expect(prisma.license.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { currentExpiryDate: "asc" }, take: 10, skip: 20 }),
    );
  });

  it("findAll returns licenses alongside the total count", async () => {
    const licenses = [buildLicense()];
    prisma.license.findMany.mockResolvedValue(licenses);
    prisma.license.count.mockResolvedValue(1);
    await expect(repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 0 })).resolves.toEqual({
      licenses,
      total: 1,
    });
  });

  it("findCandidatesForReminder filters to active licenses with currentExpiryDate >= asOf", async () => {
    prisma.license.findMany.mockResolvedValue([]);
    const asOf = new Date("2026-01-01");
    await repo.findCandidatesForReminder(asOf);
    expect(prisma.license.findMany).toHaveBeenCalledWith({
      where: { isActive: true, currentExpiryDate: { gte: asOf } },
      orderBy: { currentExpiryDate: "asc" },
    });
  });

  it("findCandidatesForReminder scopes to a single shop when shopId is passed", async () => {
    prisma.license.findMany.mockResolvedValue([]);
    const asOf = new Date("2026-01-01");
    await repo.findCandidatesForReminder(asOf, "shop-1");
    expect(prisma.license.findMany).toHaveBeenCalledWith({
      where: { isActive: true, currentExpiryDate: { gte: asOf }, shopId: "shop-1" },
      orderBy: { currentExpiryDate: "asc" },
    });
  });

  it("update delegates to prisma.license.update scoped by id", async () => {
    const patch = { isActive: false } as any;
    prisma.license.update.mockResolvedValue(buildLicense({ isActive: false }));
    await repo.update("license-1", patch);
    expect(prisma.license.update).toHaveBeenCalledWith({ where: { id: "license-1" }, data: patch });
  });

  it("createWithInitialRenewal creates the license, its INITIAL renewal, and the cache update in one tx", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const created = buildLicense({ id: "license-new" });
    const renewal = buildLicenseRenewal({
      id: "renewal-new",
      licenseId: "license-new",
      issueDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
    });
    const cached = buildLicense({
      id: "license-new",
      currentRenewalId: "renewal-new",
      currentIssueDate: renewal.issueDate,
      currentExpiryDate: renewal.expiryDate,
    });

    tx.license.create.mockResolvedValue(created);
    tx.licenseRenewal.create.mockResolvedValue(renewal);
    tx.license.update.mockResolvedValue(cached);

    const result = await repo.createWithInitialRenewal(
      {
        shopId: "shop-1",
        productName: "Tobacco Retail License",
        licenseNumber: "TB-2026-001",
        remindDays: 7,
        isActive: true,
      } as any,
      {
        issueDate: renewal.issueDate,
        expiryDate: renewal.expiryDate,
        recordedById: "owner-1",
      } as any,
    );

    expect(tx.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ licenseNumber: "TB-2026-001" }),
    });
    expect(tx.licenseRenewal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        licenseId: "license-new",
        source: "INITIAL",
        recordedById: "owner-1",
      }),
    });
    expect(tx.license.update).toHaveBeenCalledWith({
      where: { id: "license-new" },
      data: {
        currentRenewalId: "renewal-new",
        currentIssueDate: renewal.issueDate,
        currentExpiryDate: renewal.expiryDate,
      },
    });
    expect(result).toEqual(cached);
  });

  it("renewAndUpdateCache creates a RENEWAL row and refreshes the cache in one tx", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const renewal = buildLicenseRenewal({
      id: "renewal-2",
      source: "RENEWAL",
      issueDate: new Date("2027-01-01"),
      expiryDate: new Date("2028-01-01"),
    });
    const updated = buildLicense({
      currentRenewalId: "renewal-2",
      currentIssueDate: renewal.issueDate,
      currentExpiryDate: renewal.expiryDate,
    });

    tx.licenseRenewal.create.mockResolvedValue(renewal);
    tx.license.update.mockResolvedValue(updated);

    const result = await repo.renewAndUpdateCache("license-1", {
      issueDate: renewal.issueDate,
      expiryDate: renewal.expiryDate,
      recordedById: "owner-1",
    } as any);

    expect(tx.licenseRenewal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ licenseId: "license-1", source: "RENEWAL" }),
    });
    expect(tx.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: {
        currentRenewalId: "renewal-2",
        currentIssueDate: renewal.issueDate,
        currentExpiryDate: renewal.expiryDate,
      },
    });
    expect(result).toEqual({ license: updated, renewal });
  });

  it("voidRenewalAndRecomputeCache recomputes the cache from the latest live renewal when the voided row was current", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const current = buildLicense({ currentRenewalId: "renewal-2" });
    const voided = buildLicenseRenewal({ id: "renewal-2", voidedAt: new Date() });
    const fallback = buildLicenseRenewal({
      id: "renewal-1",
      source: "INITIAL",
      issueDate: new Date("2025-01-01"),
      expiryDate: new Date("2026-01-01"),
    });
    const updated = buildLicense({
      currentRenewalId: "renewal-1",
      currentIssueDate: fallback.issueDate,
      currentExpiryDate: fallback.expiryDate,
    });

    tx.licenseRenewal.update.mockResolvedValue(voided);
    tx.licenseRenewal.findFirst.mockResolvedValue(fallback);
    tx.license.update.mockResolvedValue(updated);

    const result = await repo.voidRenewalAndRecomputeCache(
      current,
      "renewal-2",
      { voidedById: "owner-1", voidReason: "typo" },
      true,
    );

    expect(tx.licenseRenewal.update).toHaveBeenCalledWith({
      where: { id: "renewal-2" },
      data: expect.objectContaining({
        voidedAt: expect.any(Date),
        voidedById: "owner-1",
        voidReason: "typo",
      }),
    });
    expect(tx.licenseRenewal.findFirst).toHaveBeenCalledWith({
      where: { licenseId: "license-1", voidedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(tx.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: {
        currentRenewalId: "renewal-1",
        currentIssueDate: fallback.issueDate,
        currentExpiryDate: fallback.expiryDate,
      },
    });
    expect(result).toEqual({ license: updated, renewal: voided });
  });

  it("voidRenewalAndRecomputeCache clears the current* cache to null when no live renewal remains", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const current = buildLicense({ currentRenewalId: "renewal-1" });
    const voided = buildLicenseRenewal({ id: "renewal-1", voidedAt: new Date() });
    const cleared = buildLicense({
      currentRenewalId: null,
      currentIssueDate: null,
      currentExpiryDate: null,
    });

    tx.licenseRenewal.update.mockResolvedValue(voided);
    tx.licenseRenewal.findFirst.mockResolvedValue(null);
    tx.license.update.mockResolvedValue(cleared);

    const result = await repo.voidRenewalAndRecomputeCache(
      current,
      "renewal-1",
      { voidedById: "owner-1", voidReason: "typo" },
      true,
    );

    expect(tx.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: { currentRenewalId: null, currentIssueDate: null, currentExpiryDate: null },
    });
    expect(result).toEqual({ license: cleared, renewal: voided });
  });

  it("voidRenewalAndRecomputeCache returns the caller's license untouched, with no extra query, when not current", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const current = buildLicense({ currentRenewalId: "renewal-1" });
    const voided = buildLicenseRenewal({ id: "renewal-2", voidedAt: new Date() });

    tx.licenseRenewal.update.mockResolvedValue(voided);

    const result = await repo.voidRenewalAndRecomputeCache(
      current,
      "renewal-2",
      { voidedById: "owner-1", voidReason: "typo" },
      false,
    );

    expect(tx.licenseRenewal.findFirst).not.toHaveBeenCalled();
    expect(tx.license.update).not.toHaveBeenCalled();
    expect(result.license).toBe(current);
    expect(result.renewal).toBe(voided);
  });

  describe("unique-violation translation", () => {
    it("update translates a P2002 into a ConflictError", async () => {
      prisma.license.update.mockRejectedValue(buildUniqueViolationError(["shopId_licenseNumber"]));
      await expect(repo.update("license-1", { licenseNumber: "TB-DUP" } as any)).rejects.toThrow(
        new ConflictError("A license with this number already exists for this shop"),
      );
    });

    it("createWithInitialRenewal translates a P2002 from inside the transaction into a ConflictError", async () => {
      const tx = buildTx();
      tx.license.create.mockRejectedValue(buildUniqueViolationError(["shopId_licenseNumber"]));
      prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

      await expect(
        repo.createWithInitialRenewal(
          { shopId: "shop-1", productName: "L", licenseNumber: "TB-DUP", remindDays: 7 } as any,
          { issueDate: new Date(), expiryDate: new Date(), recordedById: "owner-1" } as any,
        ),
      ).rejects.toThrow(
        new ConflictError("A license with this number already exists for this shop"),
      );
    });

    it("rethrows non-P2002 errors from update", async () => {
      const error = new Error("database down");
      prisma.license.update.mockRejectedValue(error);
      await expect(repo.update("license-1", { licenseNumber: "TB-X" } as any)).rejects.toThrow(
        error,
      );
    });
  });
});
