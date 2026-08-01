// modules/license/use-cases/get-license-renewal-history.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import {
  type LicenseRenewalResult,
  toLicenseRenewalResult,
} from "../mappers/license-renewal.mapper";
import { LicenseRepository } from "../repositories/license.repository";
import { LicenseRenewalRepository } from "../repositories/license-renewal.repository";

export interface GetLicenseRenewalHistoryInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  licenseId: string;
}

@Injectable()
export class GetLicenseRenewalHistoryUseCase {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly licenseRenewalRepository: LicenseRenewalRepository,
  ) {}

  async execute(
    input: GetLicenseRenewalHistoryInput,
  ): Promise<{ renewals: LicenseRenewalResult[] }> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== license.shopId) {
      throw new AuthorizationError("Access denied for this license");
    }

    const renewals = await this.licenseRenewalRepository.findByLicense(license.id);
    return { renewals: renewals.map(toLicenseRenewalResult) };
  }
}
