// modules/license/use-cases/create-license.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface CreateLicenseInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  productName: string;
  licenseNumber: string;
  issueDate: Date;
  expiryDate: Date;
  remindDays?: number;
  paymentAmount?: number;
  paymentDate?: Date;
  documentUrl?: string;
  notes?: string;
}

@Injectable()
export class CreateLicenseUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly licenseRepository: LicenseRepository,
  ) {}

  async execute(input: CreateLicenseInput): Promise<LicenseResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("You can only register licenses for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    if (input.issueDate > input.expiryDate) {
      throw new BusinessRuleError("issueDate cannot be after expiryDate");
    }
    const remindDays = input.remindDays ?? 7;
    if (remindDays < 0) throw new BusinessRuleError("remindDays must be non-negative");

    const license = await this.licenseRepository.createWithInitialRenewal(
      {
        shopId: input.shopId,
        productName: input.productName,
        licenseNumber: input.licenseNumber,
        remindDays,
        isActive: true,
      },
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

    return toLicenseResult(license);
  }
}
