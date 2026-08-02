// modules/delivery/delivery.module.ts
import { Module } from "@nestjs/common";
import { ShopModule } from "../shop/shop.module";
import { SupplierModule } from "../supplier/supplier.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryRepository } from "./repositories/delivery.repository";
import { DeliveryPaymentRepository } from "./repositories/delivery-payment.repository";
import { CreateDeliveryUseCase } from "./use-cases/create-delivery.use-case";
import { GetDeliveriesUseCase } from "./use-cases/get-deliveries.use-case";
import { GetDeliveryByIdUseCase } from "./use-cases/get-delivery-by-id.use-case";
import { GetSupplierOutstandingUseCase } from "./use-cases/get-supplier-outstanding.use-case";
import { RecordDeliveryPaymentUseCase } from "./use-cases/record-delivery-payment.use-case";
import { VoidDeliveryUseCase } from "./use-cases/void-delivery.use-case";
import { VoidDeliveryPaymentUseCase } from "./use-cases/void-delivery-payment.use-case";

@Module({
  imports: [ShopModule, SupplierModule],
  controllers: [DeliveryController],
  providers: [
    DeliveryRepository,
    DeliveryPaymentRepository,
    CreateDeliveryUseCase,
    GetDeliveriesUseCase,
    GetDeliveryByIdUseCase,
    RecordDeliveryPaymentUseCase,
    VoidDeliveryPaymentUseCase,
    VoidDeliveryUseCase,
    GetSupplierOutstandingUseCase,
  ],
  exports: [DeliveryRepository, DeliveryPaymentRepository],
})
export class DeliveryModule {}
