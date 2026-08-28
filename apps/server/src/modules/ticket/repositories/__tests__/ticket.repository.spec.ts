// modules/ticket/repositories/__tests__/ticket.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import {
  buildNotFoundError,
  buildUniqueViolationError,
} from "../../../../test/fixtures/prisma-error.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { buildTicketMessage } from "../../../../test/fixtures/ticket-message.fixture";
import { TicketRepository } from "../ticket.repository";

describe("TicketRepository", () => {
  let prisma: any;
  let repo: TicketRepository;

  beforeEach(() => {
    prisma = {
      ticket: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      ticketMessage: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    repo = new TicketRepository(prisma);
  });

  describe("findById / findByIdOrThrow", () => {
    it("findById delegates to prisma.ticket.findUnique", async () => {
      const ticket = buildTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      await expect(repo.findById("ticket-1")).resolves.toEqual(ticket);
      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({ where: { id: "ticket-1" } });
    });

    it("findByIdOrThrow throws NotFoundError when the ticket doesn't exist", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
    });

    it("findByIdOrThrow returns the ticket when found", async () => {
      const ticket = buildTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      await expect(repo.findByIdOrThrow("ticket-1")).resolves.toEqual(ticket);
    });
  });

  describe("createWithInitialMessage", () => {
    const input = {
      shopId: "shop-1",
      type: "ISSUE" as const,
      subject: "Freezer broken",
      priority: "NORMAL" as const,
      requiresAck: false,
      createdById: "user-staff-1",
      assigneeId: null,
      body: "It's leaking",
      clientMessageId: "client-key-1",
    };

    it("happy path: creates ticket + message inside a transaction, in order", async () => {
      const ticket = buildTicket();
      const message = buildTicketMessage();
      const tx = {
        ticket: { create: vi.fn().mockResolvedValue(ticket) },
        ticketMessage: { create: vi.fn().mockResolvedValue(message) },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));

      const result = await repo.createWithInitialMessage(input);

      expect(result).toEqual({ ticket, message });
      expect(tx.ticket.create).toHaveBeenCalledWith({
        data: {
          shopId: input.shopId,
          type: input.type,
          subject: input.subject,
          priority: input.priority,
          requiresAck: input.requiresAck,
          createdById: input.createdById,
          assigneeId: input.assigneeId,
          creationClientId: input.clientMessageId,
        },
      });
      expect(tx.ticketMessage.create).toHaveBeenCalledWith({
        data: {
          ticketId: ticket.id,
          senderId: input.createdById,
          message: input.body,
          clientMessageId: input.clientMessageId,
        },
      });
    });

    it("retry path: on unique violation, looks up the existing ticket+message by (createdById, creationClientId) and returns them", async () => {
      prisma.$transaction.mockRejectedValue(
        buildUniqueViolationError(["createdById_creationClientId"]),
      );
      const existingTicket = buildTicket();
      const existingMessage = buildTicketMessage();
      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.ticketMessage.findFirst.mockResolvedValue(existingMessage);

      const result = await repo.createWithInitialMessage(input);

      expect(result).toEqual({ ticket: existingTicket, message: existingMessage });
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { createdById: input.createdById, creationClientId: input.clientMessageId },
      });
      expect(prisma.ticketMessage.findFirst).toHaveBeenCalledWith({
        where: { ticketId: existingTicket.id, clientMessageId: input.clientMessageId },
      });
    });

    it("retry path: throws ConflictError if the unique violation fires but no matching ticket is found (corrupt state)", async () => {
      prisma.$transaction.mockRejectedValue(
        buildUniqueViolationError(["createdById_creationClientId"]),
      );
      prisma.ticket.findFirst.mockResolvedValue(null);
      await expect(repo.createWithInitialMessage(input)).rejects.toThrow(ConflictError);
    });

    it("retry path: throws ConflictError if the ticket is found but the message is missing (corrupt state)", async () => {
      prisma.$transaction.mockRejectedValue(
        buildUniqueViolationError(["createdById_creationClientId"]),
      );
      prisma.ticket.findFirst.mockResolvedValue(buildTicket());
      prisma.ticketMessage.findFirst.mockResolvedValue(null);
      await expect(repo.createWithInitialMessage(input)).rejects.toThrow(ConflictError);
    });

    it("rethrows non-unique-violation errors unchanged", async () => {
      const error = new Error("database down");
      prisma.$transaction.mockRejectedValue(error);
      await expect(repo.createWithInitialMessage(input)).rejects.toThrow(error);
    });
  });

  describe("findAll", () => {
    it("scopes by shopId only when no optional filters are given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      });
    });

    it("includes type, status, priority, assigneeId, and search filters when given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({
        shopId: "shop-1",
        type: "ISSUE",
        status: "OPEN",
        priority: "HIGH",
        assigneeId: "user-2",
        search: "freezer",
        limit: 20,
        offset: 0,
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          type: "ISSUE",
          status: "OPEN",
          priority: "HIGH",
          assigneeId: "user-2",
          subject: { contains: "freezer", mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      });
    });

    it("returns tickets and total from the transaction result", async () => {
      const tickets = [buildTicket()];
      prisma.$transaction.mockResolvedValue([tickets, 1]);
      const result = await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(result).toEqual({ tickets, total: 1 });
    });
  });

  describe("transitionIfStatusIn", () => {
    it("calls updateMany with the id + from-status guard, returns the affected count", async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
      const affected = await repo.transitionIfStatusIn("ticket-1", "OPEN", {
        status: "IN_PROGRESS",
        resolvedAt: null,
      });
      expect(affected).toBe(1);
      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: "ticket-1", status: "OPEN" },
        data: { status: "IN_PROGRESS", resolvedAt: null },
      });
    });

    it("returns 0 when the guard doesn't match (status moved concurrently)", async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
      const affected = await repo.transitionIfStatusIn("ticket-1", "OPEN", {
        status: "IN_PROGRESS",
      });
      expect(affected).toBe(0);
    });
  });

  describe("updateAssignee", () => {
    it("delegates to prisma.ticket.update with the given assigneeId", async () => {
      const ticket = buildTicket({ assigneeId: "user-2" });
      prisma.ticket.update.mockResolvedValue(ticket);
      await expect(repo.updateAssignee("ticket-1", "user-2")).resolves.toEqual(ticket);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { assigneeId: "user-2" },
      });
    });

    it("supports clearing the assignee with null", async () => {
      prisma.ticket.update.mockResolvedValue(buildTicket({ assigneeId: null }));
      await repo.updateAssignee("ticket-1", null);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { assigneeId: null },
      });
    });

    it("translates a not-found error into NotFoundError", async () => {
      prisma.ticket.update.mockRejectedValue(buildNotFoundError());
      await expect(repo.updateAssignee("missing", "user-2")).rejects.toThrow(NotFoundError);
    });
  });
});
