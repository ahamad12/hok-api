// modules/delivery/use-cases/delivery-line-items.ts
import { BusinessRuleError } from "../../../common/errors";
import type { CreateDeliveryLineItemInput as PricedLineItem } from "../repositories/delivery.repository";

export interface DeliveryLineItemInput {
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitPriceCents: number;
  discrepancyNote?: string;
}

/**
 * Validates line items and snapshots lineTotalCents (received quantity ×
 * unit price, rounded). Shared by create and edit so the total rule can't
 * drift between them.
 */
export function priceLineItems(items: DeliveryLineItemInput[]): {
  lineItems: PricedLineItem[];
  totalAmountCents: number;
} {
  if (items.length === 0) {
    throw new BusinessRuleError("A delivery must have at least one line item");
  }
  for (const item of items) {
    if (item.quantityOrdered <= 0) throw new BusinessRuleError("quantityOrdered must be positive");
    if (item.quantityReceived < 0)
      throw new BusinessRuleError("quantityReceived cannot be negative");
    if (item.unitPriceCents <= 0) throw new BusinessRuleError("unitPriceCents must be positive");
  }
  const lineItems = items.map((item) => ({
    productName: item.productName,
    quantityOrdered: item.quantityOrdered,
    quantityReceived: item.quantityReceived,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: Math.round(item.quantityReceived * item.unitPriceCents),
    discrepancyNote: item.discrepancyNote ?? null,
  }));
  return {
    lineItems,
    totalAmountCents: lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
  };
}
