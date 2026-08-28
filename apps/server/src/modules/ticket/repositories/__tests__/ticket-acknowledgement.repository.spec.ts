// modules/ticket/repositories/__tests__/ticket-acknowledgement.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketAcknowledgementRepository } from "../ticket-acknowledgement.repository";

describe("TicketAcknowledgementRepository", () => {
  let prisma: any;
  let repo: TicketAcknowledgementRepository;

  beforeEach(() => {
    prisma = { ticketAcknowledgement: { upsert: vi.fn(), findMany: vi.fn() } };
    repo = new TicketAcknowledgementRepository(prisma);
  });

  describe("acknowledge", () => {
    it("upserts on the composite key and returns acknowledgedAt", async () => {
      const acknowledgedAt = new Date("2026-01-02");
      prisma.ticketAcknowledgement.upsert.mockResolvedValue({ acknowledgedAt });

      const result = await repo.acknowledge("ticket-1", "user-1");

      expect(result).toEqual(acknowledgedAt);
      expect(prisma.ticketAcknowledgement.upsert).toHaveBeenCalledWith({
        where: { ticketId_userId: { ticketId: "ticket-1", userId: "user-1" } },
        update: {},
        create: { ticketId: "ticket-1", userId: "user-1" },
      });
    });

    it("is idempotent — the update clause is empty so re-acking never moves the timestamp", async () => {
      prisma.ticketAcknowledgement.upsert.mockResolvedValue({ acknowledgedAt: new Date() });
      await repo.acknowledge("ticket-1", "user-1");
      const call = prisma.ticketAcknowledgement.upsert.mock.calls[0][0];
      expect(call.update).toEqual({});
    });
  });

  describe("findByTicketId", () => {
    it("returns a Map keyed by userId", async () => {
      const t1 = new Date("2026-01-01");
      const t2 = new Date("2026-01-02");
      prisma.ticketAcknowledgement.findMany.mockResolvedValue([
        { userId: "user-1", acknowledgedAt: t1 },
        { userId: "user-2", acknowledgedAt: t2 },
      ]);

      const result = await repo.findByTicketId("ticket-1");

      expect(result).toBeInstanceOf(Map);
      expect(result.get("user-1")).toEqual(t1);
      expect(result.get("user-2")).toEqual(t2);
    });

    it("returns an empty Map when nobody has acknowledged", async () => {
      prisma.ticketAcknowledgement.findMany.mockResolvedValue([]);
      const result = await repo.findByTicketId("ticket-1");
      expect(result.size).toBe(0);
    });
  });
});
