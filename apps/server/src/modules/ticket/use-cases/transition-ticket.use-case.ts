// apps/server/src/modules/ticket/use-cases/transition-ticket.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { type TicketStatus, UserRole } from "@tapt-api/db";
import { allowedNextStates, isValidTransition } from "../../../common/domain/ticket-transitions";
import { AuthorizationError, ConflictError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { TicketRepository } from "../repositories/ticket.repository";

@Injectable()
export class TransitionTicketUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, ticketId: string, to: TicketStatus) {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (requester.role === UserRole.STAFF && requester.shopId !== ticket.shopId) {
      throw new AuthorizationError("Cannot act on a ticket outside your shop");
    }

    // Explicit bypass — OWNER and MANAGER always pass the participant/archive
    // checks below. Named here so a future edit to the STAFF branch can't
    // accidentally start blocking them too.
    const isStaffRestricted = requester.role === UserRole.STAFF;

    if (ticket.type === "ISSUE") {
      const isParticipant =
        ticket.createdById === requester.userId || ticket.assigneeId === requester.userId;
      if (isStaffRestricted && !isParticipant) {
        throw new AuthorizationError("Only the creator or assignee can transition this ticket");
      }
      if (ticket.status === "CLOSED" && to === "OPEN") {
        const canReopen = !isStaffRestricted || ticket.createdById === requester.userId;
        if (!canReopen)
          throw new AuthorizationError("Only the creator or OWNER/MANAGER can reopen this ticket");
      }
    } else if (isStaffRestricted) {
      throw new AuthorizationError("Only OWNER/MANAGER can archive or restore this ticket");
    }

    if (!isValidTransition(ticket.type, ticket.status, to)) {
      throw new ConflictError("Invalid transition", {
        allowed: allowedNextStates(ticket.type, ticket.status),
      });
    }

    // resolvedAt policy, stated explicitly: set on entering RESOLVED,
    // cleared when leaving RESOLVED to any other state (including CLOSED
    // via RESOLVED→CLOSED — CLOSED gets a fresh null, not a stale timestamp
    // from a prior RESOLVED visit). This mirrors "reopen clears completion"
    // semantics rather than Task's "completedAt only set, never cleared."
    // Deliberate choice for Ticket: an issue can cycle through RESOLVED
    // multiple times (reopened, fixed again), so resolvedAt should always
    // reflect the most recent resolution, not the first one.
    const resolvedAt = to === "RESOLVED" ? new Date() : null;

    const affected = await this.ticketRepo.transitionIfStatusIn(ticketId, ticket.status, {
      status: to,
      resolvedAt,
    });
    if (affected === 0) {
      const fresh = await this.ticketRepo.findByIdOrThrow(ticketId);
      throw new ConflictError("Ticket was modified concurrently", {
        allowed: allowedNextStates(fresh.type, fresh.status),
      });
    }

    const updated = await this.ticketRepo.findByIdOrThrow(ticketId);

    // shopId sourced from the re-fetched row, not the pre-transition `ticket`
    // variable — shopId is immutable on Ticket today, so these are always
    // equal, but sourcing from `updated` means this line stays correct even
    // if that invariant ever changes, with zero further edits needed here.
    this.events.emit(SOCKET_EVENTS.TICKET_STATUS_CHANGED, {
      ticketId,
      shopId: updated.shopId,
      type: updated.type,
      from: ticket.status,
      to,
    });

    return updated;
  }
}
