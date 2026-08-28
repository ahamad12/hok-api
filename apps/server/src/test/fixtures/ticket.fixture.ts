import type { Ticket } from "@tapt-api/db";

export function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    shopId: "shop-1",
    type: "ISSUE",
    subject: "Freezer is broken",
    status: "OPEN",
    priority: "NORMAL",
    requiresAck: false,
    createdById: "user-staff-1",
    assigneeId: null,
    creationClientId: "client-key-1",
    resolvedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Ticket;
}
