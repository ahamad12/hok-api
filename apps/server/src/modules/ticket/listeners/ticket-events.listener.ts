// apps/server/src/modules/ticket/listeners/ticket-events.listener.ts
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { AppGateway } from "../../../infra/gateway/app.gateway";

@Injectable()
export class TicketEventsListener {
  constructor(private readonly gateway: AppGateway) {}

  @OnEvent(SOCKET_EVENTS.TICKET_CREATED)
  onCreated(payload: {
    ticketId: string;
    shopId: string;
    type: string;
    subject: string;
    priority: string;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.TICKET_CREATED, payload);
  }

  @OnEvent(SOCKET_EVENTS.TICKET_MESSAGE_CREATED)
  onMessage(payload: {
    ticketId: string;
    shopId: string;
    senderId: string;
    assigneeId: string | null;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.TICKET_MESSAGE_CREATED, payload);
    if (payload.assigneeId)
      this.gateway.emitToUser(payload.assigneeId, SOCKET_EVENTS.TICKET_MESSAGE_CREATED, payload);
  }

  @OnEvent(SOCKET_EVENTS.TICKET_STATUS_CHANGED)
  onStatusChanged(payload: {
    ticketId: string;
    shopId: string;
    type: string;
    from: string;
    to: string;
  }) {
    this.gateway.emitToShop(payload.shopId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, payload);
  }

  @OnEvent(SOCKET_EVENTS.TICKET_ASSIGNED)
  onAssigned(payload: { ticketId: string; assigneeId: string; subject: string }) {
    this.gateway.emitToUser(payload.assigneeId, SOCKET_EVENTS.TICKET_ASSIGNED, payload);
  }

  @OnEvent(SOCKET_EVENTS.TICKET_ACKNOWLEDGED)
  onAcknowledged(payload: { ticketId: string; userId: string; acknowledgedAt: Date }) {
    this.gateway.emitToUser(payload.userId, SOCKET_EVENTS.TICKET_ACKNOWLEDGED, payload);
  }
}
