// modules/ticket/use-cases/__tests__/transition-ticket.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { TransitionTicketUseCase } from "../transition-ticket.use-case";

describe("TransitionTicketUseCase", () => {
  let ticketRepo: any;
  let events: any;
  let useCase: TransitionTicketUseCase;

  beforeEach(() => {
    ticketRepo = {
      findByIdOrThrow: vi.fn(),
      transitionIfStatusIn: vi.fn().mockResolvedValue(1),
    };
    events = { emit: vi.fn() };
    useCase = new TransitionTicketUseCase(ticketRepo, events);
  });

  it("throws AuthorizationError when STAFF acts on a different shop's ticket", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(buildTicket({ shopId: "shop-1", status: "OPEN" }));
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1", "IN_PROGRESS")).rejects.toThrow(
      AuthorizationError,
    );
  });

  describe("ISSUE participant gating", () => {
    it("throws AuthorizationError when STAFF is neither creator nor assignee", async () => {
      ticketRepo.findByIdOrThrow.mockResolvedValue(
        buildTicket({
          shopId: "shop-1",
          status: "OPEN",
          type: "ISSUE",
          createdById: "other",
          assigneeId: null,
        }),
      );
      const requester = buildRequestUser({
        userId: "user-staff-1",
        role: "STAFF",
        shopId: "shop-1",
      });
      await expect(useCase.execute(requester, "ticket-1", "IN_PROGRESS")).rejects.toThrow(
        AuthorizationError,
      );
    });

    it("allows the STAFF creator to transition", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "OPEN",
            type: "ISSUE",
            createdById: "user-staff-1",
          }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      const requester = buildRequestUser({
        userId: "user-staff-1",
        role: "STAFF",
        shopId: "shop-1",
      });
      await expect(useCase.execute(requester, "ticket-1", "IN_PROGRESS")).resolves.toBeDefined();
    });

    it("allows the STAFF assignee to transition even if not the creator", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "OPEN",
            type: "ISSUE",
            createdById: "other",
            assigneeId: "user-staff-1",
          }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      const requester = buildRequestUser({
        userId: "user-staff-1",
        role: "STAFF",
        shopId: "shop-1",
      });
      await expect(useCase.execute(requester, "ticket-1", "IN_PROGRESS")).resolves.toBeDefined();
    });

    it("bypasses the participant check entirely for MANAGER, even as a non-participant", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "OPEN",
            type: "ISSUE",
            createdById: "someone-else",
            assigneeId: null,
          }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      const requester = buildRequestUser({ role: "MANAGER", shopId: "different-shop" });
      await expect(useCase.execute(requester, "ticket-1", "IN_PROGRESS")).resolves.toBeDefined();
    });
  });

  describe("reopen gating (CLOSED -> OPEN)", () => {
    it("throws AuthorizationError when a non-creator STAFF tries to reopen", async () => {
      ticketRepo.findByIdOrThrow.mockResolvedValue(
        buildTicket({
          shopId: "shop-1",
          status: "CLOSED",
          type: "ISSUE",
          createdById: "other",
          assigneeId: "user-staff-1",
        }),
      );
      const requester = buildRequestUser({
        userId: "user-staff-1",
        role: "STAFF",
        shopId: "shop-1",
      });
      await expect(useCase.execute(requester, "ticket-1", "OPEN")).rejects.toThrow(
        AuthorizationError,
      );
    });

    it("allows the STAFF creator to reopen", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "CLOSED",
            type: "ISSUE",
            createdById: "user-staff-1",
          }),
        )
        .mockResolvedValueOnce(buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }));
      const requester = buildRequestUser({
        userId: "user-staff-1",
        role: "STAFF",
        shopId: "shop-1",
      });
      await expect(useCase.execute(requester, "ticket-1", "OPEN")).resolves.toBeDefined();
    });

    it("allows OWNER/MANAGER to reopen regardless of creator", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "CLOSED",
            type: "ISSUE",
            createdById: "someone-else",
          }),
        )
        .mockResolvedValueOnce(buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }));
      const requester = buildRequestUser({ role: "OWNER", shopId: null });
      await expect(useCase.execute(requester, "ticket-1", "OPEN")).resolves.toBeDefined();
    });
  });

  describe("broadcast (INSTRUCTION/ANNOUNCEMENT) archive gating", () => {
    it("throws AuthorizationError when STAFF attempts to archive", async () => {
      ticketRepo.findByIdOrThrow.mockResolvedValue(
        buildTicket({ shopId: "shop-1", status: "OPEN", type: "ANNOUNCEMENT" }),
      );
      const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
      await expect(useCase.execute(requester, "ticket-1", "CLOSED")).rejects.toThrow(
        AuthorizationError,
      );
    });

    it("allows MANAGER to archive regardless of shop", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "OPEN", type: "ANNOUNCEMENT" }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "CLOSED", type: "ANNOUNCEMENT" }),
        );
      const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
      await expect(useCase.execute(requester, "ticket-1", "CLOSED")).resolves.toBeDefined();
    });
  });

  it("throws ConflictError with allowed states when the transition is invalid for the type", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }),
    );
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(useCase.execute(requester, "ticket-1", "RESOLVED")).rejects.toThrow(ConflictError);
  });

  describe("optimistic concurrency", () => {
    it("throws ConflictError when transitionIfStatusIn reports 0 affected (status moved concurrently)", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }))
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      ticketRepo.transitionIfStatusIn.mockResolvedValue(0);
      const requester = buildRequestUser({ role: "OWNER", shopId: null });
      await expect(useCase.execute(requester, "ticket-1", "CLOSED")).rejects.toThrow(ConflictError);
    });

    it("passes the guard (id, from-status, data) to the repository", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }))
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      const requester = buildRequestUser({ role: "OWNER", shopId: null });
      await useCase.execute(requester, "ticket-1", "IN_PROGRESS");
      expect(ticketRepo.transitionIfStatusIn).toHaveBeenCalledWith(
        "ticket-1",
        "OPEN",
        expect.objectContaining({ status: "IN_PROGRESS" }),
      );
    });
  });

  describe("resolvedAt policy", () => {
    it("sets resolvedAt to a Date when transitioning to RESOLVED", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "RESOLVED", type: "ISSUE" }),
        );
      const requester = buildRequestUser({ role: "OWNER", shopId: null });
      await useCase.execute(requester, "ticket-1", "RESOLVED");
      expect(ticketRepo.transitionIfStatusIn).toHaveBeenCalledWith(
        "ticket-1",
        "IN_PROGRESS",
        expect.objectContaining({ resolvedAt: expect.any(Date) }),
      );
    });

    it("clears resolvedAt to null for any transition that is not RESOLVED, even from RESOLVED", async () => {
      ticketRepo.findByIdOrThrow
        .mockResolvedValueOnce(
          buildTicket({
            shopId: "shop-1",
            status: "RESOLVED",
            type: "ISSUE",
            resolvedAt: new Date(),
          }),
        )
        .mockResolvedValueOnce(
          buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" }),
        );
      const requester = buildRequestUser({ role: "OWNER", shopId: null });
      await useCase.execute(requester, "ticket-1", "IN_PROGRESS");
      expect(ticketRepo.transitionIfStatusIn).toHaveBeenCalledWith(
        "ticket-1",
        "RESOLVED",
        expect.objectContaining({ resolvedAt: null }),
      );
    });
  });

  it("emits TICKET_STATUS_CHANGED with shopId sourced from the re-fetched (post-write) ticket", async () => {
    const preTicket = buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" });
    const postTicket = buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" });
    ticketRepo.findByIdOrThrow.mockResolvedValueOnce(preTicket).mockResolvedValueOnce(postTicket);
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await useCase.execute(requester, "ticket-1", "IN_PROGRESS");
    expect(events.emit).toHaveBeenCalledWith(
      "ticket:status_changed",
      expect.objectContaining({
        ticketId: "ticket-1",
        shopId: postTicket.shopId,
        from: "OPEN",
        to: "IN_PROGRESS",
      }),
    );
  });

  it("returns the re-fetched, post-write ticket", async () => {
    const postTicket = buildTicket({ shopId: "shop-1", status: "IN_PROGRESS", type: "ISSUE" });
    ticketRepo.findByIdOrThrow
      .mockResolvedValueOnce(buildTicket({ shopId: "shop-1", status: "OPEN", type: "ISSUE" }))
      .mockResolvedValueOnce(postTicket);
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    const result = await useCase.execute(requester, "ticket-1", "IN_PROGRESS");
    expect(result).toEqual(postTicket);
  });
});
