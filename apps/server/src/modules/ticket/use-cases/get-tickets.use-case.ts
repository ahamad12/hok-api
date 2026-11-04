// apps/server/src/modules/ticket/use-cases/get-tickets.use-case.ts
import { Injectable } from "@nestjs/common";
import { TicketPriority, TicketStatus, TicketType } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";

@Injectable()
export class GetTicketsUseCase {
  constructor(private readonly ticketRepo: TicketRepository) {}

  async execute(
    requester: RequestUser,
    query: {
      shopId: string;
      type?: TicketType;
      status?: TicketStatus;
      priority?: TicketPriority;
      assigneeId?: string;
      search?: string;
      limit: number;
      offset: number;
    },
  ) {
    if (!canAccessShop(requester, query.shopId)) {
      throw new AuthorizationError("Cannot list tickets outside your shop");
    }
    return this.ticketRepo.findAll(query);
  }
}
