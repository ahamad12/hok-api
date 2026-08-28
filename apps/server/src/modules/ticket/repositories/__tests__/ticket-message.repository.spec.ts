// modules/ticket/repositories/__tests__/ticket-message.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildTicketMessage } from "../../../../test/fixtures/ticket-message.fixture";
import { TicketMessageRepository } from "../ticket-message.repository";

describe("TicketMessageRepository", () => {
  let prisma: any;
  let repo: TicketMessageRepository;

  beforeEach(() => {
    prisma = {
      ticketMessage: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repo = new TicketMessageRepository(prisma);
  });

  describe("createIdempotent", () => {
    const input = {
      ticketId: "ticket-1",
      senderId: "user-staff-1",
      message: "hi",
      mediaUrl: null,
      clientMessageId: "client-msg-1",
    };

    it("returns the existing row with created:false when a matching clientMessageId already exists", async () => {
      const existing = buildTicketMessage();
      prisma.ticketMessage.findFirst.mockResolvedValue(existing);

      const result = await repo.createIdempotent(input);

      expect(result).toEqual({ row: existing, created: false });
      expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
    });

    it("creates and returns created:true when no matching row exists", async () => {
      prisma.ticketMessage.findFirst.mockResolvedValue(null);
      const created = buildTicketMessage();
      prisma.ticketMessage.create.mockResolvedValue(created);

      const result = await repo.createIdempotent(input);

      expect(result).toEqual({ row: created, created: true });
      expect(prisma.ticketMessage.create).toHaveBeenCalledWith({ data: input });
    });

    it("handles the race: findUnique misses, create hits P2002, re-fetch finds the row — returns created:false", async () => {
      prisma.ticketMessage.findFirst.mockResolvedValueOnce(null); // initial check misses
      prisma.ticketMessage.create.mockRejectedValue(
        buildUniqueViolationError(["ticketId_clientMessageId"]),
      );
      const existing = buildTicketMessage();
      prisma.ticketMessage.findFirst.mockResolvedValueOnce(existing); // race re-fetch hits

      const result = await repo.createIdempotent(input);

      expect(result).toEqual({ row: existing, created: false });
    });

    it("rethrows a unique violation if the race re-fetch still finds nothing (corrupt state)", async () => {
      prisma.ticketMessage.findFirst.mockResolvedValueOnce(null);
      const violation = buildUniqueViolationError(["ticketId_clientMessageId"]);
      prisma.ticketMessage.create.mockRejectedValue(violation);
      prisma.ticketMessage.findFirst.mockResolvedValueOnce(null);

      await expect(repo.createIdempotent(input)).rejects.toThrow();
    });

    it("rethrows non-unique-violation errors from create unchanged", async () => {
      prisma.ticketMessage.findFirst.mockResolvedValue(null);
      const error = new Error("database down");
      prisma.ticketMessage.create.mockRejectedValue(error);
      await expect(repo.createIdempotent(input)).rejects.toThrow(error);
    });
  });

  describe("findRecentByTicketId", () => {
    it("fetches in descending sequence order, then reverses to oldest-first for display", async () => {
      const newest = buildTicketMessage({ id: "m-3", sequence: 3 });
      const middle = buildTicketMessage({ id: "m-2", sequence: 2 });
      const oldest = buildTicketMessage({ id: "m-1", sequence: 1 });
      prisma.ticketMessage.findMany.mockResolvedValue([newest, middle, oldest]);

      const result = await repo.findRecentByTicketId("ticket-1", 20);

      expect(prisma.ticketMessage.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { sequence: "desc" },
        take: 20,
      });
      expect(result.map((m) => m.id)).toEqual(["m-1", "m-2", "m-3"]);
    });

    it("returns an empty array when there are no messages", async () => {
      prisma.ticketMessage.findMany.mockResolvedValue([]);
      await expect(repo.findRecentByTicketId("ticket-1", 20)).resolves.toEqual([]);
    });
  });

  describe("findPage", () => {
    it("omits the sequence filter when `since` is not given", async () => {
      prisma.ticketMessage.findMany.mockResolvedValue([]);
      await repo.findPage("ticket-1", { limit: 50 });
      expect(prisma.ticketMessage.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { sequence: "asc" },
        take: 51,
      });
    });

    it("filters sequence > since when given", async () => {
      prisma.ticketMessage.findMany.mockResolvedValue([]);
      await repo.findPage("ticket-1", { since: 10, limit: 50 });
      expect(prisma.ticketMessage.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1", sequence: { gt: 10 } },
        orderBy: { sequence: "asc" },
        take: 51,
      });
    });

    it("returns nextCursor: null and all rows when fewer rows than the limit come back", async () => {
      const rows = [buildTicketMessage({ sequence: 1 }), buildTicketMessage({ sequence: 2 })];
      prisma.ticketMessage.findMany.mockResolvedValue(rows);
      const result = await repo.findPage("ticket-1", { limit: 50 });
      expect(result).toEqual({ messages: rows, nextCursor: null });
    });

    it("trims the extra row and sets nextCursor to the last kept row's sequence when there's more", async () => {
      const rows = [1, 2, 3].map((n) => buildTicketMessage({ id: `m-${n}`, sequence: n }));
      prisma.ticketMessage.findMany.mockResolvedValue(rows); // limit: 2, take: 3 → 3 rows back means hasMore
      const result = await repo.findPage("ticket-1", { limit: 2 });
      expect(result.messages).toHaveLength(2);
      expect(result.messages.map((m) => m.id)).toEqual(["m-1", "m-2"]);
      expect(result.nextCursor).toBe(2);
    });
  });
});
