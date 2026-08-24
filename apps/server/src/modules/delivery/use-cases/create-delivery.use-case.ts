// modules/delivery/use-cases/create-delivery.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

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
  shopId: string;
  supplierId: string;
  billUrl?: string;
  deliveredAt?: Date;
  lineItems: CreateDeliveryLineItemInput[];
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
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
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

    if (input.lineItems.length === 0) {
      throw new BusinessRuleError("A delivery must have at least one line item");
    }
    for (const item of input.lineItems) {
      if (item.quantityOrdered <= 0)
        throw new BusinessRuleError("quantityOrdered must be positive");
      if (item.quantityReceived < 0)
        throw new BusinessRuleError("quantityReceived cannot be negative");
      if (item.unitPriceCents <= 0) throw new BusinessRuleError("unitPriceCents must be positive");
    }

    const lineItemsWithTotals = input.lineItems.map((item) => ({
      ...item,
      lineTotalCents: Math.round(item.quantityReceived * item.unitPriceCents),
    }));
    const totalAmountCents = lineItemsWithTotals.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );

    const delivery = await this.deliveryRepository.createWithLineItems({
      shopId: input.shopId,
      supplierId: input.supplierId,
      billUrl: input.billUrl ?? null,
      totalAmountCents,
      deliveredById: input.requesterId,
      deliveredAt: input.deliveredAt ?? new Date(),
      lineItems: lineItemsWithTotals.map((item) => ({
        productName: item.productName,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
        discrepancyNote: item.discrepancyNote ?? null,
      })),
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
