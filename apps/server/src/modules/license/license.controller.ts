// modules/license/license.controller.ts
import { Controller } from "@nestjs/common";
import { licenseContract } from "@tapt-api/api/contracts/license.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import { type CreateLicenseInput, CreateLicenseUseCase } from "./use-cases/create-license.use-case";
import { GetExpiringLicensesUseCase } from "./use-cases/get-expiring-licenses.use-case";
import { GetLicenseByIdUseCase } from "./use-cases/get-license-by-id.use-case";
import { GetLicenseRenewalHistoryUseCase } from "./use-cases/get-license-renewal-history.use-case";
import { type GetLicensesInput, GetLicensesUseCase } from "./use-cases/get-licenses.use-case";
import { type RenewLicenseInput, RenewLicenseUseCase } from "./use-cases/renew-license.use-case";
import { type UpdateLicenseInput, UpdateLicenseUseCase } from "./use-cases/update-license.use-case";
import {
  type VoidLicenseRenewalInput,
  VoidLicenseRenewalUseCase,
} from "./use-cases/void-license-renewal.use-case";

@Controller()
export class LicenseController {
  constructor(
    private readonly createLicenseUseCase: CreateLicenseUseCase,
    private readonly getLicensesUseCase: GetLicensesUseCase,
    private readonly getLicenseByIdUseCase: GetLicenseByIdUseCase,
    private readonly updateLicenseUseCase: UpdateLicenseUseCase,
    private readonly renewLicenseUseCase: RenewLicenseUseCase,
    private readonly getExpiringLicensesUseCase: GetExpiringLicensesUseCase,
    private readonly getLicenseRenewalHistoryUseCase: GetLicenseRenewalHistoryUseCase,
    private readonly voidLicenseRenewalUseCase: VoidLicenseRenewalUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(licenseContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateLicenseInput, "requesterId" | "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createLicenseUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(licenseContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetLicensesInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getLicensesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(licenseContract.getExpiring)
  getExpiring(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: { shopId: string } }) => {
      const result = await this.getExpiringLicensesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        shopId: query.shopId,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(licenseContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getLicenseByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        licenseId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(licenseContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<UpdateLicenseInput, "requesterRole" | "requesterShopId" | "licenseId">;
    }) => {
      const result = await this.updateLicenseUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        licenseId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(licenseContract.renew)
  renew(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<
        RenewLicenseInput,
        "requesterId" | "requesterRole" | "requesterShopId" | "licenseId"
      >;
    }) => {
      const result = await this.renewLicenseUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        licenseId: params.id,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(licenseContract.getRenewalHistory)
  getRenewalHistory(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getLicenseRenewalHistoryUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        licenseId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(licenseContract.voidRenewal)
  voidRenewal(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string; renewalId: string };
      body: Pick<VoidLicenseRenewalInput, "voidReason">;
    }) => {
      const result = await this.voidLicenseRenewalUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        licenseId: params.id,
        renewalId: params.renewalId,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }
}
