// apps/server/src/modules/ticket/use-cases/assign-ticket.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { UserRepository } from "../../auth/repositories/user.repository";
import { TicketRepository } from "../repositories/ticket.repository";

@Injectable()
export class AssignTicketUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly userRepo: UserRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, ticketId: string, assigneeId: string | null) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (ticket.type !== "ISSUE") throw new BusinessRuleError("Only ISSUE tickets can be assigned");
    if (requester.role === UserRole.STAFF)
      throw new AuthorizationError("STAFF cannot assign tickets");
    if (!canAccessShop(requester, ticket.shopId)) {
      throw new AuthorizationError("Cannot assign tickets outside your business");
    }

    if (assigneeId) {
      const assignee = await this.userRepo.findById(assigneeId);
      if (!assignee) throw new BusinessRuleError("Assignee not found");

      // Global invariant: structurally valid role/shop/supervisor combination.
      // Same call as create-ticket.use-case.ts — single source of truth,
      // not duplicated as inline logic.
      assertValidUserRoleAssignment({
        role: assignee.role,
        shopId: assignee.shopId,
        isSupervisor: assignee.isSupervisor,
      });

      // Ticket-specific rule: assignee must be active STAFF in *this* ticket's shop.
      if (
        assignee.role !== UserRole.STAFF ||
        assignee.shopId !== ticket.shopId ||
        !assignee.isActive
      ) {
        throw new BusinessRuleError("Assignee must be an active STAFF member of this shop");
      }
    }

    const updated = await this.ticketRepo.updateAssignee(ticketId, assigneeId);
    if (assigneeId) {
      this.events.emit(SOCKET_EVENTS.TICKET_ASSIGNED, {
        ticketId,
        assigneeId,
        subject: ticket.subject,
      });
    }
    return updated;
  }
}
