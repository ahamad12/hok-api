// apps/server/src/modules/ticket/use-cases/create-ticket.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { TicketPriority, TicketType, UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { UserRepository } from "../../auth/repositories/user.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { TicketRepository } from "../repositories/ticket.repository";

interface CreateTicketInput {
  shopId: string;
  type: TicketType;
  subject: string;
  priority?: TicketPriority;
  assigneeId?: string;
  requiresAck?: boolean;
  body: string;
  clientMessageId: string;
}

@Injectable()
export class CreateTicketUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly shopRepo: ShopRepository,
    private readonly userRepo: UserRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, input: CreateTicketInput) {
    // System-wide MANAGER — only STAFF is shop-scoped.
    if (!canAccessShop(requester, input.shopId)) {
      throw new AuthorizationError("Cannot create a ticket outside your shop");
    }

    if (input.type !== "ISSUE" && requester.role === UserRole.STAFF) {
      throw new AuthorizationError(
        "Only OWNER/MANAGER can create INSTRUCTION or ANNOUNCEMENT tickets",
      );
    }

    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    if (input.assigneeId) {
      if (input.type !== "ISSUE")
        throw new BusinessRuleError("assigneeId is only valid for ISSUE tickets");
      const assignee = await this.userRepo.findById(input.assigneeId);
      if (!assignee) throw new BusinessRuleError("Assignee not found");

      assertValidUserRoleAssignment({
        role: assignee.role,
        shopId: assignee.shopId,
        isSupervisor: assignee.isSupervisor,
      });

      if (
        assignee.role !== UserRole.STAFF ||
        assignee.shopId !== input.shopId ||
        !assignee.isActive
      ) {
        throw new BusinessRuleError("Assignee must be an active STAFF member of this shop");
      }
    }

    const requiresAck = input.type === TicketType.ISSUE ? false : (input.requiresAck ?? true);

    const { ticket, message } = await this.ticketRepo.createWithInitialMessage({
      shopId: input.shopId,
      type: input.type,
      subject: input.subject,
      priority: input.priority ?? TicketPriority.NORMAL,
      requiresAck,
      createdById: requester.userId,
      assigneeId: input.assigneeId ?? null,
      body: input.body,
      clientMessageId: input.clientMessageId,
    });

    this.events.emit(SOCKET_EVENTS.TICKET_CREATED, {
      ticketId: ticket.id,
      shopId: ticket.shopId,
      type: ticket.type,
      subject: ticket.subject,
      priority: ticket.priority,
    });

    return { ticket, message };
  }
}
