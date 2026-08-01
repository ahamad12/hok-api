import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLicense } from "../../../../test/fixtures/license.fixture";
import { LicenseRepository } from "../license.repository";

function buildPrismaMock() {
  return {
    license: {
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
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

  it("existsByLicenseNumber returns true when count > 0", async () => {
    prisma.license.count.mockResolvedValue(1);
    await expect(repo.existsByLicenseNumber("shop-1", "TB-2026-001")).resolves.toBe(true);
    expect(prisma.license.count).toHaveBeenCalledWith({
      where: { shopId: "shop-1", licenseNumber: "TB-2026-001" },
    });
  });

  it("existsByLicenseNumber returns false when count is 0", async () => {
    prisma.license.count.mockResolvedValue(0);
    await expect(repo.existsByLicenseNumber("shop-1", "TB-2026-001")).resolves.toBe(false);
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

  it("create delegates to prisma.license.create with the given data", async () => {
    const input = {
      shopId: "shop-1",
      productName: "Tobacco License",
      licenseNumber: "TB-1",
      remindDays: 7,
      isActive: true,
    } as any;
    prisma.license.create.mockResolvedValue(buildLicense());
    await repo.create(input);
    expect(prisma.license.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.license.update scoped by id", async () => {
    const patch = { isActive: false } as any;
    prisma.license.update.mockResolvedValue(buildLicense({ isActive: false }));
    await repo.update("license-1", patch);
    expect(prisma.license.update).toHaveBeenCalledWith({ where: { id: "license-1" }, data: patch });
  });
});
