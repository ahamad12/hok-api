// apps/server/src/modules/ticket/use-cases/get-messages.use-case.ts
import { Injectable } from "@nestjs/common";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";
import { TicketMessageRepository } from "../repositories/ticket-message.repository";

@Injectable()
export class GetMessagesUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly messageRepo: TicketMessageRepository,
  ) {}

  async execute(
    requester: RequestUser,
    ticketId: string,
    query: { since?: number; limit: number },
  ) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (!canAccessShop(requester, ticket.shopId)) {
      throw new AuthorizationError("Cannot view messages outside your shop");
    }

    return this.messageRepo.findPage(ticketId, query);
  }
}
