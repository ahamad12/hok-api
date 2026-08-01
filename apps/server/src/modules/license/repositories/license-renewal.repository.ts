// modules/license/repositories/license-renewal.repository.ts
import { Injectable } from "@nestjs/common";
import type { LicenseRenewal } from "@tapt-api/db";
import { PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

@Injectable()
export class LicenseRenewalRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<LicenseRenewal | null> {
    return this.prisma.licenseRenewal.findUnique({ where: { id } });
  }

  findByLicense(licenseId: string): Promise<LicenseRenewal[]> {
    return this.prisma.licenseRenewal.findMany({
      where: { licenseId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Most recent non-voided renewal for a license — used to recompute
   *  the cache after a void. */
  findLatestActive(licenseId: string): Promise<LicenseRenewal | null> {
    return this.prisma.licenseRenewal.findFirst({
      where: { licenseId, voidedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: Prisma.LicenseRenewalUncheckedCreateInput): Promise<LicenseRenewal> {
    return this.prisma.licenseRenewal.create({ data });
  }

  update(id: string, data: Prisma.LicenseRenewalUncheckedUpdateInput): Promise<LicenseRenewal> {
    return this.prisma.licenseRenewal.update({ where: { id }, data });
  }
}
