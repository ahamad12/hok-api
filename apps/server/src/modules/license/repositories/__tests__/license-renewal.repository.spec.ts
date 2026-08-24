import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLicenseRenewal } from "../../../../test/fixtures/license-renewal.fixture";
import { LicenseRenewalRepository } from "../license-renewal.repository";

function buildPrismaMock() {
  return {
    licenseRenewal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
});
