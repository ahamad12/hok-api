// modules/delivery/delivery.controller.ts
import { Controller, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { deliveryContract } from "@tapt-api/api/contracts/delivery.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import {
  type CreateDeliveryInput,
  CreateDeliveryUseCase,
} from "./use-cases/create-delivery.use-case";
import { type GetDeliveriesInput, GetDeliveriesUseCase } from "./use-cases/get-deliveries.use-case";
import { GetDeliveryByIdUseCase } from "./use-cases/get-delivery-by-id.use-case";
import { GetSupplierOutstandingUseCase } from "./use-cases/get-supplier-outstanding.use-case";
import { ReceiveDeliveryUseCase } from "./use-cases/receive-delivery.use-case";
import {
  type RecordDeliveryPaymentInput,
  RecordDeliveryPaymentUseCase,
} from "./use-cases/record-delivery-payment.use-case";
import {
  type UpdateDeliveryInput,
  UpdateDeliveryUseCase,
} from "./use-cases/update-delivery.use-case";
import {
  MAX_BILL_BYTES,
  UploadDeliveryBillUseCase,
  type UploadedBillFile,
} from "./use-cases/upload-delivery-bill.use-case";
import { type VoidDeliveryInput, VoidDeliveryUseCase } from "./use-cases/void-delivery.use-case";
import {
  type VoidDeliveryPaymentInput,
  VoidDeliveryPaymentUseCase,
} from "./use-cases/void-delivery-payment.use-case";

@Controller()
export class DeliveryController {
  constructor(
    private readonly createDeliveryUseCase: CreateDeliveryUseCase,
    private readonly getDeliveriesUseCase: GetDeliveriesUseCase,
    private readonly getDeliveryByIdUseCase: GetDeliveryByIdUseCase,
    private readonly recordDeliveryPaymentUseCase: RecordDeliveryPaymentUseCase,
    private readonly voidDeliveryPaymentUseCase: VoidDeliveryPaymentUseCase,
    private readonly voidDeliveryUseCase: VoidDeliveryUseCase,
    private readonly getSupplierOutstandingUseCase: GetSupplierOutstandingUseCase,
    private readonly updateDeliveryUseCase: UpdateDeliveryUseCase,
    private readonly receiveDeliveryUseCase: ReceiveDeliveryUseCase,
    private readonly uploadDeliveryBillUseCase: UploadDeliveryBillUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateDeliveryInput, "requesterId" | "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createDeliveryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetDeliveriesInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getDeliveriesUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.getSupplierOutstanding)
  getSupplierOutstanding(@CurrentUser() user: RequestUser) {
    return async ({ query }: { query: { shopId: string } }) => {
      const result = await this.getSupplierOutstandingUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        shopId: query.shopId,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getDeliveryByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Pick<UpdateDeliveryInput, "supplierId" | "deliveredAt" | "lineItems">;
    }) => {
      const result = await this.updateDeliveryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(deliveryContract.receive)
  receive(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.receiveDeliveryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BILL_BYTES, files: 1 } }))
  @TsRestHandler(deliveryContract.uploadBill)
  uploadBill(@CurrentUser() user: RequestUser, @UploadedFile() file: UploadedBillFile | undefined) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.uploadDeliveryBillUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
        file,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(deliveryContract.recordPayment)
  recordPayment(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<
        RecordDeliveryPaymentInput,
        "requesterId" | "requesterRole" | "requesterShopId" | "deliveryId"
      >;
    }) => {
      const result = await this.recordDeliveryPaymentUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(deliveryContract.voidPayment)
  voidPayment(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { paymentId: string };
      body: Pick<VoidDeliveryPaymentInput, "voidReason">;
    }) => {
      const result = await this.voidDeliveryPaymentUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        paymentId: params.paymentId,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(deliveryContract.voidDelivery)
  voidDelivery(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Pick<VoidDeliveryInput, "voidReason">;
    }) => {
      const result = await this.voidDeliveryUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        deliveryId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }
}
