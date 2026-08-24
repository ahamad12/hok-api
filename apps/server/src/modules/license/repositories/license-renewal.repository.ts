// modules/license/repositories/license-renewal.repository.ts
import { Injectable } from "@nestjs/common";
import type { LicenseRenewal } from "@tapt-api/db";
import { PrismaService } from "@tapt-api/db";

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
}
