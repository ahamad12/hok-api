// modules/license/use-cases/get-license-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface GetLicenseByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  licenseId: string;
}

@Injectable()
export class GetLicenseByIdUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: GetLicenseByIdInput): Promise<LicenseResult> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== license.shopId) {
      throw new AuthorizationError("Access denied for this license");
    }

    return toLicenseResult(license);
  }
}
