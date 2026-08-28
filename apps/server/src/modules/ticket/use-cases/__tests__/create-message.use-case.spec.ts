// modules/ticket/use-cases/__tests__/create-message.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { buildTicketMessage } from "../../../../test/fixtures/ticket-message.fixture";
import { CreateMessageUseCase } from "../create-message.use-case";

describe("CreateMessageUseCase", () => {
  let ticketRepo: any;
  let messageRepo: any;
  let events: any;
  let useCase: CreateMessageUseCase;

  const input = { message: "hi", clientMessageId: "client-msg-1" };

  beforeEach(() => {
    ticketRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildTicket({ shopId: "shop-1", type: "ISSUE" })),
    };
    messageRepo = {
      createIdempotent: vi.fn().mockResolvedValue({ row: buildTicketMessage(), created: true }),
    };
    events = { emit: vi.fn() };
    useCase = new CreateMessageUseCase(ticketRepo, messageRepo, events);
  });

  it("throws AuthorizationError when STAFF messages a different shop's ticket", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1", input)).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when STAFF is not the creator or assignee of an ISSUE", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({
        shopId: "shop-1",
        type: "ISSUE",
        createdById: "someone-else",
        assigneeId: null,
      }),
    );
    const requester = buildRequestUser({ userId: "user-staff-1", role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "ticket-1", input)).rejects.toThrow(AuthorizationError);
  });

  it("allows the STAFF creator to message their own ISSUE", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({ shopId: "shop-1", type: "ISSUE", createdById: "user-staff-1" }),
    );
    const requester = buildRequestUser({ userId: "user-staff-1", role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "ticket-1", input)).resolves.toBeDefined();
  });

  it("allows the STAFF assignee to message an ISSUE they didn't create", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({
        shopId: "shop-1",
        type: "ISSUE",
        createdById: "someone-else",
        assigneeId: "user-staff-1",
      }),
    );
    const requester = buildRequestUser({ userId: "user-staff-1", role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "ticket-1", input)).resolves.toBeDefined();
  });

  it("allows STAFF to message a broadcast in their shop without a participant check", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(
      buildTicket({
        shopId: "shop-1",
        type: "ANNOUNCEMENT",
        createdById: "someone-else",
        assigneeId: null,
      }),
    );
    const requester = buildRequestUser({ userId: "user-staff-1", role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "ticket-1", input)).resolves.toBeDefined();
  });

  it("emits TICKET_MESSAGE_CREATED when the write is new", async () => {
    messageRepo.createIdempotent.mockResolvedValue({ row: buildTicketMessage(), created: true });
    await useCase.execute(buildRequestUser({ role: "OWNER", shopId: null }), "ticket-1", input);
    expect(events.emit).toHaveBeenCalledWith("ticket:message_created", expect.any(Object));
  });

  it("does NOT emit when the write was a replayed retry (created: false)", async () => {
    messageRepo.createIdempotent.mockResolvedValue({ row: buildTicketMessage(), created: false });
    await useCase.execute(buildRequestUser({ role: "OWNER", shopId: null }), "ticket-1", input);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("passes clientMessageId through to the repository", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER", shopId: null }), "ticket-1", input);
    expect(messageRepo.createIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({ clientMessageId: "client-msg-1" }),
    );
  });

  it("returns the row from the repository regardless of created flag", async () => {
    const row = buildTicketMessage({ id: "existing" });
    messageRepo.createIdempotent.mockResolvedValue({ row, created: false });
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER", shopId: null }),
      "ticket-1",
      input,
    );
    expect(result).toEqual(row);
  });
});
