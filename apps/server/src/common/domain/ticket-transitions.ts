// apps/server/src/common/domain/ticket-transitions.ts
import { TicketStatus, TicketType } from "@tapt-api/db";

const ISSUE_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["OPEN"],
};

const BROADCAST_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["CLOSED"],
  IN_PROGRESS: [],
  RESOLVED: [],
  CLOSED: ["OPEN"],
};

function matrixFor(type: TicketType): Record<TicketStatus, TicketStatus[]> {
  return type === "ISSUE" ? ISSUE_TRANSITIONS : BROADCAST_TRANSITIONS;
}

export function isValidTransition(type: TicketType, from: TicketStatus, to: TicketStatus): boolean {
  return matrixFor(type)[from]?.includes(to) ?? false;
}

export function allowedNextStates(type: TicketType, from: TicketStatus): TicketStatus[] {
  return matrixFor(type)[from] ?? [];
}
