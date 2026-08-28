// apps/server/src/modules/ticket/use-cases/create-message.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";
import { TicketMessageRepository } from "../repositories/ticket-message.repository";

@Injectable()
export class CreateMessageUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly messageRepo: TicketMessageRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    requester: RequestUser,
    ticketId: string,
    input: { message: string; mediaUrl?: string; clientMessageId: string },
  ) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (requester.role === UserRole.STAFF && requester.shopId !== ticket.shopId) {
      throw new AuthorizationError("Cannot message a ticket outside your shop");
    }
    if (requester.role === UserRole.STAFF && ticket.type === "ISSUE") {
      const isParticipant =
        ticket.createdById === requester.userId || ticket.assigneeId === requester.userId;
      if (!isParticipant)
        throw new AuthorizationError("Only the creator or assignee can reply to this ticket");
    }

    const { row, created } = await this.messageRepo.createIdempotent({
      ticketId,
      senderId: requester.userId,
      message: input.message,
      mediaUrl: input.mediaUrl ?? null,
      clientMessageId: input.clientMessageId,
    });

    // Only fan out on an actual new write — a replayed retry shouldn't re-broadcast.
    if (created) {
      this.events.emit(SOCKET_EVENTS.TICKET_MESSAGE_CREATED, {
        ticketId,
        shopId: ticket.shopId,
        senderId: requester.userId,
        assigneeId: ticket.assigneeId,
      });
    }

    return row;
  }
}
