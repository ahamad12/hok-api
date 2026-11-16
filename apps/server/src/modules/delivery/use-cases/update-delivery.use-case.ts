// modules/delivery/use-cases/update-delivery.use-case.ts
import { Injectable } from "@nestjs/common";
import { DeliveryStatus, type UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { SupplierRepository } from "../../supplier/repositories/supplier.repository";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { type DeliveryLineItemInput, priceLineItems } from "./delivery-line-items";

export interface UpdateDeliveryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  deliveryId: string;
  supplierId?: string;
  deliveredAt?: Date;
  lineItems?: DeliveryLineItemInput[];
}

/**
 * Fixes a delivery while it is still being counted: PENDING and unpaid.
 * Anyone in the shop may do it. Once checked in, the lines are locked.
 */
@Injectable()
export class UpdateDeliveryUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly supplierRepository: SupplierRepository,
  ) {}

  async execute(input: UpdateDeliveryInput): Promise<DeliveryResult> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);
    if (!canAccessShop(requesterScope(input), delivery.shopId)) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt) throw new BusinessRuleError("Cannot edit a voided delivery");
    if (delivery.status !== DeliveryStatus.PENDING) {
      throw new BusinessRuleError(
        "This delivery is checked in and can't be edited — void it and log it again",
      );
    }

    if (input.supplierId && input.supplierId !== delivery.supplierId) {
      const supplier = await this.supplierRepository.findById(input.supplierId);
      if (!supplier) throw new NotFoundError("Supplier", input.supplierId);
      if (supplier.shopId !== delivery.shopId) {
        throw new BusinessRuleError("Supplier does not belong to this delivery's shop");
      }
      if (!supplier.isActive) {
        throw new BusinessRuleError("Cannot move a delivery to a deactivated supplier");
      }
    }

    const priced = input.lineItems ? priceLineItems(input.lineItems) : undefined;

    // The repository's guarded write re-checks PENDING, unvoided and unpaid.
    const updated = await this.deliveryRepository.updateIfPending(delivery.id, {
      supplierId: input.supplierId,
      deliveredAt: input.deliveredAt,
      lineItems: priced?.lineItems,
    });
    return toDeliveryResult(updated);
  }
}
