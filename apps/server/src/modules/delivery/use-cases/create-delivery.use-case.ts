// modules/delivery/use-cases/create-delivery.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { priceLineItems } from "./delivery-line-items";

export interface CreateDeliveryLineItemInput {
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitPriceCents: number;
  discrepancyNote?: string;
}

export interface CreateDeliveryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  supplierId: string;
  billUrl?: string;
  deliveredAt?: Date;
  lineItems: CreateDeliveryLineItemInput[];
  /** Check in at once instead of starting PENDING. */
  receiveNow?: boolean;
}

@Injectable()
export class CreateDeliveryUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly deliveryRepository: DeliveryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: CreateDeliveryInput): Promise<DeliveryResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("You can only record deliveries for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const supplier = await this.supplierRepository.findById(input.supplierId);
    if (!supplier) throw new NotFoundError("Supplier", input.supplierId);
    if (supplier.shopId !== input.shopId) {
      throw new BusinessRuleError("Supplier does not belong to the specified shop");
    }
    if (!supplier.isActive) {
      throw new BusinessRuleError("Cannot create a delivery for a deactivated supplier");
    }

    const { lineItems, totalAmountCents } = priceLineItems(input.lineItems);

    const delivery = await this.deliveryRepository.createWithLineItems({
      shopId: input.shopId,
      supplierId: input.supplierId,
      billUrl: input.billUrl ?? null,
      totalAmountCents,
      deliveredById: input.requesterId,
      deliveredAt: input.deliveredAt ?? new Date(),
      lineItems,
      receiveNow: input.receiveNow ?? false,
    });

    this.eventEmitter.emit("delivery.created", {
      deliveryId: delivery.id,
      shopId: input.shopId,
      supplierId: input.supplierId,
      supplierName: supplier.name,
      lineItemCount: input.lineItems.length,
      totalAmountCents,
    });

    return toDeliveryResult(delivery);
  }
}
