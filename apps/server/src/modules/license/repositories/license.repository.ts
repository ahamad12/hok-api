// modules/license/repositories/license.repository.ts
import { Injectable } from "@nestjs/common";
import type { License, LicenseRenewal } from "@tapt-api/db";
import { PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

export interface LicenseFilters {
  shopId: string;
  isActive?: boolean;
  isExpired?: boolean;
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
    if (filters.isExpired !== undefined) {
      const now = new Date();
      if (filters.isExpired) {
        where.currentExpiryDate = { lt: now };
      } else {
        // null expiry means not expired (no renewal yet) per mapper isExpired=false
        where.OR = [{ currentExpiryDate: null }, { currentExpiryDate: { gte: now } }];
      }
    }

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
   * across all shops in one query.
   */
  findCandidatesForReminder(asOf: Date, shopId?: string): Promise<License[]> {
    const where: Prisma.LicenseWhereInput = { isActive: true, currentExpiryDate: { gte: asOf } };
    if (shopId) where.shopId = shopId;
    return this.prisma.license.findMany({ where, orderBy: { currentExpiryDate: "asc" } });
  }

  async update(id: string, data: Prisma.LicenseUncheckedUpdateInput): Promise<License> {
    try {
      return await this.prisma.license.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A license with this number already exists for this shop");
      }
      throw error;
    }
  }

  /**
   * Creates a License plus its INITIAL LicenseRenewal, then refreshes
   * the License's denormalized current* cache to point at that renewal —
   * all three writes in one transaction so a License row is never
   * observable without its initial renewal (or vice versa).
   */
  async createWithInitialRenewal(
    data: Prisma.LicenseUncheckedCreateInput,
    renewalData: Omit<Prisma.LicenseRenewalUncheckedCreateInput, "licenseId" | "source">,
  ): Promise<License> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.license.create({ data });

        const renewal = await tx.licenseRenewal.create({
          data: { ...renewalData, licenseId: created.id, source: "INITIAL" },
        });

        return tx.license.update({
          where: { id: created.id },
          data: {
            currentRenewalId: renewal.id,
            currentIssueDate: renewal.issueDate,
            currentExpiryDate: renewal.expiryDate,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A license with this number already exists for this shop");
      }
      throw error;
    }
  }

  /**
   * Records a new RENEWAL row and refreshes the License's current*
   * cache to point at it, in one transaction.
   */
  async renewAndUpdateCache(
    licenseId: string,
    renewalData: Omit<Prisma.LicenseRenewalUncheckedCreateInput, "licenseId" | "source">,
  ): Promise<{ license: License; renewal: LicenseRenewal }> {
    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.licenseRenewal.create({
        data: { ...renewalData, licenseId, source: "RENEWAL" },
      });

      const license = await tx.license.update({
        where: { id: licenseId },
        data: {
          currentRenewalId: renewal.id,
          currentIssueDate: renewal.issueDate,
          currentExpiryDate: renewal.expiryDate,
        },
      });

      return { license, renewal };
    });
  }

  /**
   * Voids a renewal, then — only when `wasCurrent` is true — recomputes
   * the License's current* cache from the most recent still-live
   * renewal (or clears it to null if none remain). `currentLicense` and
   * `wasCurrent` are supplied by the caller, which already holds the
   * pre-void License row from its earlier read; when the voided renewal
   * wasn't current, that row is returned unchanged with no extra query.
   */
  async voidRenewalAndRecomputeCache(
    currentLicense: License,
    renewalId: string,
    voidData: { voidedById: string; voidReason: string },
    wasCurrent: boolean,
  ): Promise<{ license: License; renewal: LicenseRenewal }> {
    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.licenseRenewal.update({
        where: { id: renewalId },
        data: { voidedAt: new Date(), ...voidData },
      });

      if (!wasCurrent) {
        return { license: currentLicense, renewal };
      }

      const fallback = await tx.licenseRenewal.findFirst({
        where: { licenseId: currentLicense.id, voidedAt: null },
        orderBy: { createdAt: "desc" },
      });

      const license = await tx.license.update({
        where: { id: currentLicense.id },
        data: {
          currentRenewalId: fallback?.id ?? null,
          currentIssueDate: fallback?.issueDate ?? null,
          currentExpiryDate: fallback?.expiryDate ?? null,
        },
      });

      return { license, renewal };
    });
  }
}
