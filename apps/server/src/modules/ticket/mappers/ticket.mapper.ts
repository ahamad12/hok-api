// apps/server/src/modules/ticket/mappers/ticket.mapper.ts
import type { Ticket, TicketMessage } from "@tapt-api/db";

export type TicketResult = Pick<
  Ticket,
  | "id"
  | "shopId"
  | "type"
  | "subject"
  | "status"
  | "priority"
  | "requiresAck"
  | "createdById"
  | "assigneeId"
  | "resolvedAt"
  | "createdAt"
  | "updatedAt"
>;

export function toTicketResult(ticket: Ticket): TicketResult {
  const {
    id,
    shopId,
    type,
    subject,
    status,
    priority,
    requiresAck,
    createdById,
    assigneeId,
    resolvedAt,
    createdAt,
    updatedAt,
  } = ticket;
  return {
    id,
    shopId,
    type,
    subject,
    status,
    priority,
    requiresAck,
    createdById,
    assigneeId,
    resolvedAt,
    createdAt,
    updatedAt,
  };
}

export function toTicketResults(tickets: Ticket[]): TicketResult[] {
  return tickets.map(toTicketResult);
}

export type MessageResult = Pick<
  TicketMessage,
  | "id"
  | "ticketId"
  | "senderId"
  | "message"
  | "mediaUrl"
  | "clientMessageId"
  | "sequence"
  | "createdAt"
>;

export function toMessageResult(message: TicketMessage): MessageResult {
  const {
    id,
    ticketId,
    senderId,
    message: body,
    mediaUrl,
    clientMessageId,
    sequence,
    createdAt,
  } = message;
  return { id, ticketId, senderId, message: body, mediaUrl, clientMessageId, sequence, createdAt };
}

export function toMessageResults(messages: TicketMessage[]): MessageResult[] {
  return messages.map(toMessageResult);
}
