// modules/ticket/mappers/__tests__/ticket.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { buildTicketMessage } from "../../../../test/fixtures/ticket-message.fixture";
import {
  toMessageResult,
  toMessageResults,
  toTicketResult,
  toTicketResults,
} from "../ticket.mapper";

describe("toTicketResult", () => {
  it("maps all whitelisted fields", () => {
    const ticket = buildTicket();
    expect(toTicketResult(ticket)).toEqual({
      id: ticket.id,
      shopId: ticket.shopId,
      type: ticket.type,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      requiresAck: ticket.requiresAck,
      createdById: ticket.createdById,
      assigneeId: ticket.assigneeId,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  });

  it("does not leak fields beyond the whitelisted set — specifically creationClientId", () => {
    const result = toTicketResult(buildTicket());
    expect(Object.keys(result).sort()).toEqual(
      [
        "assigneeId",
        "createdAt",
        "createdById",
        "id",
        "priority",
        "requiresAck",
        "resolvedAt",
        "shopId",
        "status",
        "subject",
        "type",
        "updatedAt",
      ].sort(),
    );
    expect(result).not.toHaveProperty("creationClientId");
  });

  it("passes through a null assigneeId and resolvedAt unchanged", () => {
    const result = toTicketResult(buildTicket({ assigneeId: null, resolvedAt: null }));
    expect(result.assigneeId).toBeNull();
    expect(result.resolvedAt).toBeNull();
  });
});

describe("toTicketResults", () => {
  it("maps an array, preserving order", () => {
    const tickets = [buildTicket({ id: "t-1" }), buildTicket({ id: "t-2" })];
    const results = toTicketResults(tickets);
    expect(results.map((r) => r.id)).toEqual(["t-1", "t-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toTicketResults([])).toEqual([]);
  });
});

describe("toMessageResult", () => {
  it("maps all whitelisted fields, renaming the raw `message` field correctly", () => {
    const message = buildTicketMessage();
    expect(toMessageResult(message)).toEqual({
      id: message.id,
      ticketId: message.ticketId,
      senderId: message.senderId,
      message: message.message,
      mediaUrl: message.mediaUrl,
      clientMessageId: message.clientMessageId,
      sequence: message.sequence,
      createdAt: message.createdAt,
    });
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toMessageResult(buildTicketMessage());
    expect(Object.keys(result).sort()).toEqual(
      [
        "clientMessageId",
        "createdAt",
        "id",
        "mediaUrl",
        "message",
        "sequence",
        "senderId",
        "ticketId",
      ].sort(),
    );
  });

  it("passes through a null clientMessageId and mediaUrl unchanged", () => {
    const result = toMessageResult(buildTicketMessage({ clientMessageId: null, mediaUrl: null }));
    expect(result.clientMessageId).toBeNull();
    expect(result.mediaUrl).toBeNull();
  });
});

describe("toMessageResults", () => {
  it("maps an array, preserving order", () => {
    const messages = [
      buildTicketMessage({ id: "m-1", sequence: 1 }),
      buildTicketMessage({ id: "m-2", sequence: 2 }),
    ];
    const results = toMessageResults(messages);
    expect(results.map((r) => r.id)).toEqual(["m-1", "m-2"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toMessageResults([])).toEqual([]);
  });
});
