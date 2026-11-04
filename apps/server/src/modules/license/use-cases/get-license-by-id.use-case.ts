// modules/license/use-cases/get-license-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface GetLicenseByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  licenseId: string;
}

@Injectable()
export class GetLicenseByIdUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: GetLicenseByIdInput): Promise<LicenseResult> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (!canAccessShop(requesterScope(input), license.shopId)) {
      throw new AuthorizationError("Access denied for this license");
    }

    return toLicenseResult(license);
  }
}
