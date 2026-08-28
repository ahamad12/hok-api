import type { TicketMessage } from "@tapt-api/db";

export function buildTicketMessage(overrides: Partial<TicketMessage> = {}): TicketMessage {
  return {
    id: "message-1",
    ticketId: "ticket-1",
    senderId: "user-staff-1",
    message: "It's leaking on the floor",
    mediaUrl: null,
    clientMessageId: "client-msg-1",
    sequence: 1,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as TicketMessage;
}
