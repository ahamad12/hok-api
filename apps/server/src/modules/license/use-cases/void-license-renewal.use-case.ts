// modules/license/use-cases/void-license-renewal.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
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
  requesterTenantShopIds?: readonly string[];
  licenseId: string;
  renewalId: string;
  voidReason: string;
}

@Injectable()
export class VoidLicenseRenewalUseCase {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly licenseRenewalRepository: LicenseRenewalRepository,
  ) {}

  async execute(
    input: VoidLicenseRenewalInput,
  ): Promise<{ license: LicenseResult; renewal: LicenseRenewalResult }> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (!canAccessShop(requesterScope(input), license.shopId)) {
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
      // renewals exist" — only a currently-active one does.
      const hasLiveLaterRenewal = allRenewals.some(
        (r) => r.id !== renewal.id && r.voidedAt === null,
      );
      if (hasLiveLaterRenewal) {
        throw new BusinessRuleError("Cannot void the initial renewal while later renewals exist");
      }
    }

    const wasCurrent = license.currentRenewalId === renewal.id;

    const { license: updatedLicense, renewal: voidedRenewal } =
      await this.licenseRepository.voidRenewalAndRecomputeCache(
        license,
        renewal.id,
        { voidedById: input.requesterId, voidReason: input.voidReason },
        wasCurrent,
      );

    return {
      license: toLicenseResult(updatedLicense),
      renewal: toLicenseRenewalResult(voidedRenewal),
    };
  }
}
