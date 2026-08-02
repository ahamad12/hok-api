// modules/delivery/mappers/delivery-line-item.mapper.ts
import type { DeliveryLineItem } from "@tapt-api/db";

export type DeliveryLineItemResult = Pick<
  DeliveryLineItem,
  | "id"
  | "deliveryId"
  | "productName"
  | "quantityOrdered"
  | "quantityReceived"
  | "unit"
  | "unitPriceCents"
  | "lineTotalCents"
  | "discrepancyNote"
  | "createdAt"
> & { hasDiscrepancy: boolean };

export function toDeliveryLineItemResult(item: DeliveryLineItem): DeliveryLineItemResult {
  const {
    id,
    deliveryId,
    productName,
    quantityOrdered,
    quantityReceived,
    unit,
    unitPriceCents,
    lineTotalCents,
    discrepancyNote,
    createdAt,
  } = item;
  return {
    id,
    deliveryId,
    productName,
    quantityOrdered,
    quantityReceived,
    unit,
    unitPriceCents,
    lineTotalCents,
    discrepancyNote,
    createdAt,
    hasDiscrepancy: quantityOrdered !== quantityReceived,
  };
}
