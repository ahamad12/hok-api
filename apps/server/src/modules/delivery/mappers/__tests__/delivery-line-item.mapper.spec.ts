// mappers/__tests__/delivery-line-item.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildDeliveryLineItem } from "../../../../test/fixtures/delivery-line-item.fixture";
import { toDeliveryLineItemResult } from "../delivery-line-item.mapper";

describe("toDeliveryLineItemResult", () => {
  it("flags hasDiscrepancy false when ordered equals received", () => {
    const result = toDeliveryLineItemResult(
      buildDeliveryLineItem({ quantityOrdered: 20, quantityReceived: 20 }),
    );
    expect(result.hasDiscrepancy).toBe(false);
  });

  it("flags hasDiscrepancy true on a short shipment", () => {
    const result = toDeliveryLineItemResult(
      buildDeliveryLineItem({ quantityOrdered: 20, quantityReceived: 18 }),
    );
    expect(result.hasDiscrepancy).toBe(true);
  });

  it("flags hasDiscrepancy true even on an over-delivery", () => {
    const result = toDeliveryLineItemResult(
      buildDeliveryLineItem({ quantityOrdered: 20, quantityReceived: 22 }),
    );
    expect(result.hasDiscrepancy).toBe(true);
  });

  it("preserves the discrepancy note", () => {
    const result = toDeliveryLineItemResult(
      buildDeliveryLineItem({ discrepancyNote: "2 loaves damaged in transit" }),
    );
    expect(result.discrepancyNote).toBe("2 loaves damaged in transit");
  });
});
