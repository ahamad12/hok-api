// apps/server/src/modules/ticket/use-cases/acknowledge-ticket.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";
import { TicketAcknowledgementRepository } from "../repositories/ticket-acknowledgement.repository";

@Injectable()
export class AcknowledgeTicketUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly ackRepo: TicketAcknowledgementRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, ticketId: string) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (ticket.type === "ISSUE")
      throw new BusinessRuleError("ISSUE tickets do not use acknowledgements");
    if (!ticket.requiresAck)
      throw new BusinessRuleError("This ticket does not require acknowledgement");
    if (!canAccessShop(requester, ticket.shopId)) {
      throw new AuthorizationError("Not targeted by this ticket");
    }

    const acknowledgedAt = await this.ackRepo.acknowledge(ticketId, requester.userId);
    this.events.emit(SOCKET_EVENTS.TICKET_ACKNOWLEDGED, {
      ticketId,
      userId: requester.userId,
      acknowledgedAt,
    });
    return { acknowledgedAt };
  }
}
