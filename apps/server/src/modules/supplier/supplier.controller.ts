// modules/supplier/supplier.controller.ts
import { Controller } from "@nestjs/common";
import { supplierContract } from "@tapt-api/api/contracts/supplier.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type CreateSupplierInput,
  CreateSupplierUseCase,
} from "./use-cases/create-supplier.use-case";
import { GetSupplierByIdUseCase } from "./use-cases/get-supplier-by-id.use-case";
import { type GetSuppliersInput, GetSuppliersUseCase } from "./use-cases/get-suppliers.use-case";
import {
  type UpdateSupplierInput,
  UpdateSupplierUseCase,
} from "./use-cases/update-supplier.use-case";

@Controller()
export class SupplierController {
  constructor(
    private readonly createSupplierUseCase: CreateSupplierUseCase,
    private readonly getSuppliersUseCase: GetSuppliersUseCase,
    private readonly getSupplierByIdUseCase: GetSupplierByIdUseCase,
    private readonly updateSupplierUseCase: UpdateSupplierUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(supplierContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateSupplierInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createSupplierUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(supplierContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetSuppliersInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getSuppliersUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(supplierContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getSupplierByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        supplierId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(supplierContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<UpdateSupplierInput, "requesterRole" | "requesterShopId" | "supplierId">;
    }) => {
      const result = await this.updateSupplierUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        supplierId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }
}
