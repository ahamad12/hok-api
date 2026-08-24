// modules/license/use-cases/get-licenses.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface GetLicensesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  isActive?: boolean;
  isExpiringSoon?: boolean;
  isExpired?: boolean;
  limit: number;
  offset: number;
}

@Injectable()
export class GetLicensesUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: GetLicensesInput): Promise<{ licenses: LicenseResult[]; total: number }> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { licenses, total } = await this.licenseRepository.findAll(
      { shopId: input.shopId, isActive: input.isActive, isExpired: input.isExpired },
      { limit: input.limit, offset: input.offset },
    );

    let mapped = licenses.map((l) => toLicenseResult(l));

    // isExpiringSoon varies per row (remindDays) — cannot be pushed to SQL,
    // so filter in memory after the paginated fetch. `total` remains the
    // DB count pre-filter for this case (accepted trade-off, documented).
    // isExpired is now pushed to SQL via findAll where clause, so `total`
    // is correct when filtering by isExpired alone.
    if (input.isExpiringSoon) mapped = mapped.filter((l) => l.isExpiringSoon);

    return { licenses: mapped, total };
  }
}
