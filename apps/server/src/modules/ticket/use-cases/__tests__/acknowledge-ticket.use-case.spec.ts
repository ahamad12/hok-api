// modules/ticket/use-cases/__tests__/acknowledge-ticket.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { AcknowledgeTicketUseCase } from "../acknowledge-ticket.use-case";

describe("AcknowledgeTicketUseCase", () => {
  let ticketRepo: any;
  let ackRepo: any;
  let events: any;
  let useCase: AcknowledgeTicketUseCase;

  beforeEach(() => {
    ticketRepo = {
      findByIdOrThrow: vi
        .fn()
        .mockResolvedValue(
          buildTicket({ shopId: "shop-1", type: "ANNOUNCEMENT", requiresAck: true }),
        ),
    };
    ackRepo = { acknowledge: vi.fn().mockResolvedValue(new Date("2026-01-02")) };
    events = { emit: vi.fn() };
    useCase = new AcknowledgeTicketUseCase(ticketRepo, ackRepo, events);
  });

  it("throws BusinessRuleError when the ticket is an ISSUE", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(buildTicket({ type: "ISSUE" }));
    await expect(useCase.execute(buildRequestUser(), "ticket-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when the ticket does not require acknowledgement", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({ type: "ANNOUNCEMENT", requiresAck: false }),
    );
    await expect(useCase.execute(buildRequestUser(), "ticket-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws AuthorizationError when STAFF acknowledges different shop ticket", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows OWNER/MANAGER to acknowledge regardless of shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, "ticket-1")).resolves.toBeDefined();
  });

  it("emits TICKET_ACKNOWLEDGED with the acknowledging user's id", async () => {
    const requester = buildRequestUser({ userId: "user-9", role: "STAFF", shopId: "shop-1" });
    await useCase.execute(requester, "ticket-1");
    expect(events.emit).toHaveBeenCalledWith(
      "ticket:acknowledged",
      expect.objectContaining({ ticketId: "ticket-1", userId: "user-9" }),
    );
  });

  it("returns the acknowledgedAt timestamp from the repository", async () => {
    const result = await useCase.execute(
      buildRequestUser({ role: "STAFF", shopId: "shop-1" }),
      "ticket-1",
    );
    expect(result).toEqual({ acknowledgedAt: new Date("2026-01-02") });
  });
});
