// modules/supplier/use-cases/update-supplier.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { CategoryRepository } from "../../category/repositories/category.repository";
import { type SupplierResult, toSupplierResult } from "../mappers/supplier.mapper";
import { SupplierRepository } from "../repositories/supplier.repository";

export interface UpdateSupplierInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  supplierId: string;
  categoryId?: string;
  name?: string;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateSupplierUseCase {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: UpdateSupplierInput): Promise<SupplierResult> {
    const supplier = await this.supplierRepository.findById(input.supplierId);
    if (!supplier) throw new NotFoundError("Supplier", input.supplierId);

    if (!canAccessShop(requesterScope(input), supplier.shopId)) {
      throw new AuthorizationError("Access denied for this supplier");
    }

    if (input.categoryId && input.categoryId !== supplier.categoryId) {
      const newCategory = await this.categoryRepository.findById(input.categoryId);
      if (!newCategory) throw new NotFoundError("Category", input.categoryId);
      if (newCategory.shopId !== supplier.shopId) {
        throw new BusinessRuleError("Category does not belong to this supplier's shop");
      }
      if (!newCategory.isActive) {
        throw new BusinessRuleError("Cannot move a supplier to an inactive category");
      }
    }

    const updated = await this.supplierRepository.update(supplier.id, {
      categoryId: input.categoryId,
      name: input.name,
      phone: input.phone,
      address: input.address,
      isActive: input.isActive,
    });

    return toSupplierResult(updated);
  }
}
