// modules/supplier/use-cases/create-supplier.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { CategoryRepository } from "../../category/repositories/category.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type SupplierResult, toSupplierResult } from "../mappers/supplier.mapper";
import { SupplierRepository } from "../repositories/supplier.repository";

export interface CreateSupplierInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  categoryId: string;
  name: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class CreateSupplierUseCase {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: CreateSupplierInput): Promise<SupplierResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("You can only create suppliers for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) throw new NotFoundError("Category", input.categoryId);
    if (category.shopId !== input.shopId) {
      throw new BusinessRuleError("Category does not belong to the specified shop");
    }
    if (!category.isActive) {
      throw new BusinessRuleError("Cannot add a supplier under an inactive category");
    }

    const supplier = await this.supplierRepository.create({
      shopId: input.shopId,
      categoryId: input.categoryId,
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      isActive: true,
    });

    return toSupplierResult(supplier);
  }
}
