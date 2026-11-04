// modules/license/use-cases/update-license.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface UpdateLicenseInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  licenseId: string;
  productName?: string;
  licenseNumber?: string;
  remindDays?: number;
  isActive?: boolean;
}

@Injectable()
export class UpdateLicenseUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: UpdateLicenseInput): Promise<LicenseResult> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (!canAccessShop(requesterScope(input), license.shopId)) {
      throw new AuthorizationError("Access denied for this license");
    }

    if (input.remindDays !== undefined && input.remindDays < 0) {
      throw new BusinessRuleError("remindDays must be non-negative");
    }

    const updated = await this.licenseRepository.update(license.id, {
      productName: input.productName,
      licenseNumber: input.licenseNumber,
      remindDays: input.remindDays,
      isActive: input.isActive,
    });

    return toLicenseResult(updated);
  }
}
