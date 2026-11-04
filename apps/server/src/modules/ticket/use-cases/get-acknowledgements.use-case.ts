// apps/server/src/modules/ticket/use-cases/get-acknowledgements.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { UserRepository } from "../../auth/repositories/user.repository";
import { TicketRepository } from "../repositories/ticket.repository";
import { TicketAcknowledgementRepository } from "../repositories/ticket-acknowledgement.repository";

@Injectable()
export class GetAcknowledgementsUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly userRepo: UserRepository,
    private readonly ackRepo: TicketAcknowledgementRepository,
  ) {}

  async execute(requester: RequestUser, ticketId: string) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    if (ticket.type === "ISSUE")
      throw new BusinessRuleError("ISSUE tickets do not have an audience roster");
    if (requester.role === UserRole.STAFF)
      throw new AuthorizationError("STAFF cannot view the acknowledgement roster");
    if (!canAccessShop(requester, ticket.shopId)) {
      throw new AuthorizationError("Cannot view tickets outside your business");
    }

    const members = await this.userRepo.findActiveByShop(ticket.shopId, ticket.createdById);
    const acked = await this.ackRepo.findByTicketId(ticketId);

    const audience = members.map((m) => ({
      userId: m.id,
      displayName: m.displayName,
      acknowledgedAt: acked.get(m.id) ?? null,
    }));

    return {
      audience,
      totalAudience: audience.length,
      acknowledgedCount: audience.filter((a) => a.acknowledgedAt !== null).length,
    };
  }
}
