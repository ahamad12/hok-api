// modules/ticket/use-cases/__tests__/assign-ticket.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { AssignTicketUseCase } from "../assign-ticket.use-case";

describe("AssignTicketUseCase", () => {
  let ticketRepo: any;
  let userRepo: any;
  let events: any;
  let useCase: AssignTicketUseCase;

  beforeEach(() => {
    ticketRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildTicket({ shopId: "shop-1", type: "ISSUE" })),
      updateAssignee: vi
        .fn()
        .mockResolvedValue(buildTicket({ shopId: "shop-1", type: "ISSUE", assigneeId: "user-2" })),
    };
    userRepo = {
      findById: vi
        .fn()
        .mockResolvedValue(
          buildUser({ id: "user-2", role: "STAFF", shopId: "shop-1", isActive: true }),
        ),
    };
    events = { emit: vi.fn() };
    useCase = new AssignTicketUseCase(ticketRepo, userRepo, events);
  });

  it("throws BusinessRuleError when the ticket is not an ISSUE", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(buildTicket({ type: "ANNOUNCEMENT" }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws AuthorizationError when a STAFF user attempts to assign", async () => {
    await expect(
      useCase.execute(buildRequestUser({ role: "STAFF" }), "ticket-1", "user-2"),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows MANAGER to assign a ticket in a shop that is not their own", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, "ticket-1", "user-2")).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when the assignee does not exist", async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "missing"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError for assignee with invalid role shop combination", async () => {
    userRepo.findById.mockResolvedValue(buildUser({ role: "OWNER", shopId: "shop-1" }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee is not STAFF", async () => {
    userRepo.findById.mockResolvedValue(buildUser({ role: "MANAGER", shopId: "shop-1" }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee is STAFF in a different shop than the ticket", async () => {
    userRepo.findById.mockResolvedValue(buildUser({ role: "STAFF", shopId: "other-shop" }));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee is inactive", async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ role: "STAFF", shopId: "shop-1", isActive: false }),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2"),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("skips assignee validation entirely when clearing the assignee with null", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", null);
    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(ticketRepo.updateAssignee).toHaveBeenCalledWith("ticket-1", null);
  });

  it("emits TICKET_ASSIGNED only when assigneeId is non-null", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2");
    expect(events.emit).toHaveBeenCalledWith(
      "ticket:assigned",
      expect.objectContaining({ ticketId: "ticket-1", assigneeId: "user-2" }),
    );
  });

  it("does not emit when clearing the assignee", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", null);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("returns the updated ticket", async () => {
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1", "user-2");
    expect(result.assigneeId).toBe("user-2");
  });
});
