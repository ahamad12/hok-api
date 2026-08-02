import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryEventsListener } from "../../listeners/delivery-events.listener";

describe("DeliveryEventsListener", () => {
  let gateway: { emitToShop: ReturnType<typeof vi.fn> };
  let listener: DeliveryEventsListener;

  beforeEach(() => {
    gateway = { emitToShop: vi.fn() };
    listener = new DeliveryEventsListener(gateway as any);
  });

  describe("handleDeliveryCreated", () => {
    it("emits DELIVERY_CREATED to the shop with the payload", () => {
      const payload = {
        deliveryId: "d-1",
        shopId: "shop-1",
        supplierId: "sup-1",
        supplierName: "Acme Wholesale",
        lineItemCount: 3,
        totalAmountCents: 4500,
      };
      listener.handleDeliveryCreated(payload);
      expect(gateway.emitToShop).toHaveBeenCalledWith(
        "shop-1",
        SOCKET_EVENTS.DELIVERY_CREATED,
        payload,
      );
    });
  });
});
