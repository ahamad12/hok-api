// modules/license/use-cases/void-license-renewal.use-case.ts
import { Injectable } from "@nestjs/common";
import { PrismaService, UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import {
  type LicenseRenewalResult,
  toLicenseRenewalResult,
} from "../mappers/license-renewal.mapper";
import { LicenseRepository } from "../repositories/license.repository";
import { LicenseRenewalRepository } from "../repositories/license-renewal.repository";

export interface VoidLicenseRenewalInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  licenseId: string;
  renewalId: string;
  voidReason: string;
}

@Injectable()
export class VoidLicenseRenewalUseCase {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly licenseRenewalRepository: LicenseRenewalRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: VoidLicenseRenewalInput,
  ): Promise<{ license: LicenseResult; renewal: LicenseRenewalResult }> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== license.shopId) {
      throw new AuthorizationError("Access denied for this license");
    }

    const renewal = await this.licenseRenewalRepository.findById(input.renewalId);
    if (!renewal || renewal.licenseId !== license.id) {
      throw new NotFoundError("LicenseRenewal", input.renewalId);
    }
    if (renewal.voidedAt) throw new BusinessRuleError("This renewal has already been voided");

    if (renewal.source === "INITIAL") {
      const allRenewals = await this.licenseRenewalRepository.findByLicense(license.id);
      // C2 fix: an already-voided later renewal doesn't count as "later
      // renewals exist" — only a currently-active one does. Previously
      // this compared by id alone, so a license with one voided renewal
      // sitting after the INITIAL row could never have its INITIAL voided,
      // even though there was effectively no live history blocking it.
      const hasLiveLaterRenewal = allRenewals.some(
        (r) => r.id !== renewal.id && r.voidedAt === null,
      );
      if (hasLiveLaterRenewal) {
        throw new BusinessRuleError("Cannot void the initial renewal while later renewals exist");
      }
    }

    const { updatedLicense, voidedRenewal } = await this.prisma.$transaction(async (tx) => {
      const nowVoided = await tx.licenseRenewal.update({
        where: { id: renewal.id },
        data: { voidedAt: new Date(), voidedById: input.requesterId, voidReason: input.voidReason },
      });

      let refreshedLicense = license;
      if (license.currentRenewalId === renewal.id) {
        const fallback = await tx.licenseRenewal.findFirst({
          where: { licenseId: license.id, voidedAt: null },
          orderBy: { createdAt: "desc" },
        });
        refreshedLicense = await tx.license.update({
          where: { id: license.id },
          data: {
            currentRenewalId: fallback?.id ?? null,
            currentIssueDate: fallback?.issueDate ?? null,
            currentExpiryDate: fallback?.expiryDate ?? null,
          },
        });
      }

      return { updatedLicense: refreshedLicense, voidedRenewal: nowVoided };
    });

    return {
      license: toLicenseResult(updatedLicense),
      renewal: toLicenseRenewalResult(voidedRenewal),
    };
  }
}
