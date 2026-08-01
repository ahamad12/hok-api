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
      { shopId: input.shopId, isActive: input.isActive },
      { limit: input.limit, offset: input.offset },
    );

    let mapped = licenses.map((l) => toLicenseResult(l));

    // C1, still open: total is the SQL count pre-filter; isExpiringSoon/
    // isExpired narrow the mapped array afterward, so a caller filtering
    // by one of those will see fewer rows than `total` claims. Accepted
    // for v1 per the earlier review — isExpired could become a SQL
    // predicate (expiryDate < now) if this needs fixing later;
    // isExpiringSoon can't, since remindDays varies per row.
    if (input.isExpiringSoon) mapped = mapped.filter((l) => l.isExpiringSoon);
    if (input.isExpired) mapped = mapped.filter((l) => l.isExpired);

    return { licenses: mapped, total };
  }
}
