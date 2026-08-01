import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { LicenseRenewalRepository } from "../license-renewal.repository";

function buildPrismaMock() {
  return {
    licenseRenewal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("LicenseRenewalRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: LicenseRenewalRepository;

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new LicenseRenewalRepository(prisma as any);
  });

  it("findById delegates to prisma.licenseRenewal.findUnique", async () => {
    const renewal = buildLicenseRenewal();
    prisma.licenseRenewal.findUnique.mockResolvedValue(renewal);
    await expect(repo.findById("renewal-1")).resolves.toEqual(renewal);
    expect(prisma.licenseRenewal.findUnique).toHaveBeenCalledWith({ where: { id: "renewal-1" } });
  });

  it("findByLicense orders newest-first by createdAt", async () => {
    prisma.licenseRenewal.findMany.mockResolvedValue([]);
    await repo.findByLicense("license-1");
    expect(prisma.licenseRenewal.findMany).toHaveBeenCalledWith({
      where: { licenseId: "license-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("findLatestActive excludes voided rows", async () => {
    prisma.licenseRenewal.findFirst.mockResolvedValue(null);
    await repo.findLatestActive("license-1");
    expect(prisma.licenseRenewal.findFirst).toHaveBeenCalledWith({
      where: { licenseId: "license-1", voidedAt: null },
      orderBy: { createdAt: "desc" },
    });
  });

  it("findLatestActive returns the most recent non-voided renewal", async () => {
    const latest = buildLicenseRenewal({ id: "renewal-2", voidedAt: null });
    prisma.licenseRenewal.findFirst.mockResolvedValue(latest);
    await expect(repo.findLatestActive("license-1")).resolves.toEqual(latest);
  });

  it("create delegates to prisma.licenseRenewal.create with the given data", async () => {
    const input = {
      licenseId: "license-1",
      source: "INITIAL",
      issueDate: new Date(),
      expiryDate: new Date(),
      recordedById: "u1",
    } as any;
    prisma.licenseRenewal.create.mockResolvedValue(buildLicenseRenewal());
    await repo.create(input);
    expect(prisma.licenseRenewal.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.licenseRenewal.update scoped by id", async () => {
    const patch = { voidedAt: new Date(), voidedById: "u1", voidReason: "typo" } as any;
    prisma.licenseRenewal.update.mockResolvedValue(buildLicenseRenewal());
    await repo.update("renewal-1", patch);
    expect(prisma.licenseRenewal.update).toHaveBeenCalledWith({
      where: { id: "renewal-1" },
      data: patch,
    });
  });
});
