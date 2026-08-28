// apps/server/src/modules/ticket/use-cases/get-ticket-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";
import { TicketMessageRepository } from "../repositories/ticket-message.repository";

@Injectable()
export class GetTicketByIdUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly messageRepo: TicketMessageRepository,
  ) {}

  async execute(requester: RequestUser, ticketId: string, recentMessages: number) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (requester.role === UserRole.STAFF && requester.shopId !== ticket.shopId) {
      throw new AuthorizationError("Cannot view a ticket outside your shop");
    }

    const messages = await this.messageRepo.findRecentByTicketId(ticketId, recentMessages);
    return { ticket, messages };
  }
}
