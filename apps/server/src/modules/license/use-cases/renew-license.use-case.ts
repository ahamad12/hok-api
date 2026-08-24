// modules/license/use-cases/renew-license.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import {
  type LicenseRenewalResult,
  toLicenseRenewalResult,
} from "../mappers/license-renewal.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface RenewLicenseInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  licenseId: string;
  issueDate: Date;
  expiryDate: Date;
  paymentAmount?: number;
  paymentDate?: Date;
  documentUrl?: string;
  notes?: string;
}

@Injectable()
export class RenewLicenseUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(
    input: RenewLicenseInput,
  ): Promise<{ license: LicenseResult; renewal: LicenseRenewalResult }> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== license.shopId) {
      throw new AuthorizationError("Access denied for this license");
    }

    // C3: renewing an inactive (retired) license is blocked. Reactivate
    // via update-license first — that's the one path that flips isActive,
    // deliberately, so renew can't silently resurrect a retired license.
    if (!license.isActive) {
      throw new BusinessRuleError("Cannot renew an inactive license — reactivate it first");
    }

    if (input.issueDate > input.expiryDate) {
      throw new BusinessRuleError("issueDate cannot be after expiryDate");
    }
    if (license.currentExpiryDate && input.expiryDate <= license.currentExpiryDate) {
      throw new BusinessRuleError("New expiryDate must be after the current expiryDate");
    }

    const { license: updatedLicense, renewal } = await this.licenseRepository.renewAndUpdateCache(
      license.id,
      {
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        paymentAmount: input.paymentAmount ?? null,
        paymentDate: input.paymentDate ?? null,
        documentUrl: input.documentUrl ?? null,
        notes: input.notes ?? null,
        recordedById: input.requesterId,
      },
    );

    return { license: toLicenseResult(updatedLicense), renewal: toLicenseRenewalResult(renewal) };
  }
}
