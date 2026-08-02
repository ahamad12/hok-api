// modules/license/repositories/license.repository.ts
import { Injectable } from "@nestjs/common";
import type { License } from "@tapt-api/db";
import { PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

export interface LicenseFilters {
  shopId: string;
  isActive?: boolean;
}

@Injectable()
export class LicenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<License | null> {
    return this.prisma.license.findUnique({ where: { id } });
  }

  async findAll(
    filters: LicenseFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ licenses: License[]; total: number }> {
    const where: Prisma.LicenseWhereInput = { shopId: filters.shopId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [licenses, total] = await this.prisma.$transaction([
      this.prisma.license.findMany({
        where,
        orderBy: { currentExpiryDate: "asc" },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.license.count({ where }),
    ]);
    return { licenses, total };
  }

  /**
   * Active licenses with a known current expiry on or after `asOf`.
   * shopId is optional: the dashboard (get-expiring-licenses) scopes to
   * one shop at the DB level; the reminder processor omits it to scan
   * across all shops in one query. Previously this always fetched every
   * shop's candidates and filtered in memory for the dashboard case —
   * fixed to filter at the query level instead.
   */
  findCandidatesForReminder(asOf: Date, shopId?: string): Promise<License[]> {
    const where: Prisma.LicenseWhereInput = { isActive: true, currentExpiryDate: { gte: asOf } };
    if (shopId) where.shopId = shopId;
    return this.prisma.license.findMany({ where, orderBy: { currentExpiryDate: "asc" } });
  }

  create(data: Prisma.LicenseUncheckedCreateInput): Promise<License> {
    return this.prisma.license.create({ data });
  }

  update(id: string, data: Prisma.LicenseUncheckedUpdateInput): Promise<License> {
    return this.prisma.license.update({ where: { id }, data });
  }
}
