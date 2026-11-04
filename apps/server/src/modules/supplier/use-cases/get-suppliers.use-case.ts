// modules/supplier/use-cases/get-suppliers.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type SupplierResult, toSupplierResult } from "../mappers/supplier.mapper";
import { SupplierRepository } from "../repositories/supplier.repository";

export interface GetSuppliersInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  categoryId?: string;
  isActive?: boolean;
}

@Injectable()
export class GetSuppliersUseCase {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: GetSuppliersInput): Promise<{ suppliers: SupplierResult[] }> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const suppliers = await this.supplierRepository.findAll(input.shopId, {
      categoryId: input.categoryId,
      isActive: input.isActive ?? true,
    });
    return { suppliers: suppliers.map(toSupplierResult) };
  }
}
