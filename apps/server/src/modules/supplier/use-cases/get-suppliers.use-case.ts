// modules/supplier/use-cases/get-suppliers.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type SupplierResult, toSupplierResult } from "../mappers/supplier.mapper";
import { SupplierRepository } from "../repositories/supplier.repository";

export interface GetSuppliersInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  categoryId?: string;
  isActive?: boolean;
}

@Injectable()
export class GetSuppliersUseCase {
  constructor(private readonly supplierRepository: SupplierRepository) {}

  async execute(input: GetSuppliersInput): Promise<{ suppliers: SupplierResult[] }> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }
    const suppliers = await this.supplierRepository.findAll(input.shopId, {
      categoryId: input.categoryId,
      isActive: input.isActive,
    });
    return { suppliers: suppliers.map(toSupplierResult) };
  }
}
