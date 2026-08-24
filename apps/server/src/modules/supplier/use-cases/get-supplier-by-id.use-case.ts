// modules/supplier/use-cases/get-supplier-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type SupplierResult, toSupplierResult } from "../mappers/supplier.mapper";
import { SupplierRepository } from "../repositories/supplier.repository";

export interface GetSupplierByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  supplierId: string;
}

@Injectable()
export class GetSupplierByIdUseCase {
  constructor(private readonly supplierRepository: SupplierRepository) {}

  async execute(input: GetSupplierByIdInput): Promise<SupplierResult> {
    const supplier = await this.supplierRepository.findById(input.supplierId);
    if (!supplier) throw new NotFoundError("Supplier", input.supplierId);
    if (!supplier.isActive) throw new NotFoundError("Supplier", input.supplierId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== supplier.shopId) {
      throw new AuthorizationError("Access denied for this supplier");
    }
    return toSupplierResult(supplier);
  }
}
