import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../app.gateway";

@Injectable()
export class DeliveryEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent("delivery.created")
  handleDeliveryCreated(payload: {
    deliveryId: string;
    shopId: string;
    supplierId: string;
    supplierName: string;
    lineItemCount: number;
    totalAmountCents: number;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.DELIVERY_CREATED, payload);
  }
}
