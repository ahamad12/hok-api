// modules/ticket/use-cases/__tests__/create-ticket.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { buildTicketMessage } from "../../../../test/fixtures/ticket-message.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { CreateTicketUseCase } from "../create-ticket.use-case";

describe("CreateTicketUseCase", () => {
  let ticketRepo: any;
  let shopRepo: any;
  let userRepo: any;
  let events: any;
  let useCase: CreateTicketUseCase;

  const baseInput = {
    shopId: "shop-1",
    type: "ISSUE" as const,
    subject: "Freezer broken",
    body: "It's leaking",
    clientMessageId: "client-key-1",
  };

  beforeEach(() => {
    ticketRepo = {
      createWithInitialMessage: vi
        .fn()
        .mockResolvedValue({ ticket: buildTicket(), message: buildTicketMessage() }),
    };
    shopRepo = { findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })) };
    userRepo = { findById: vi.fn() };
    events = { emit: vi.fn() };
    useCase = new CreateTicketUseCase(ticketRepo, shopRepo, userRepo, events);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "other-shop" });
    await expect(useCase.execute(requester, baseInput)).rejects.toThrow(AuthorizationError);
  });

  it("does not shop-lock MANAGER — system-wide", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, baseInput)).resolves.toBeDefined();
  });

  it("does not shop-lock OWNER", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(useCase.execute(requester, baseInput)).resolves.toBeDefined();
  });

  it("throws AuthorizationError when STAFF attempts to create an INSTRUCTION", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, { ...baseInput, type: "INSTRUCTION" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows MANAGER to create an ANNOUNCEMENT", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { ...baseInput, type: "ANNOUNCEMENT" }),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when the shop doesn't exist", async () => {
    shopRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(buildRequestUser(), baseInput)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the shop is inactive", async () => {
    shopRepo.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute(buildRequestUser(), baseInput)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when assigneeId is given on a non-ISSUE ticket", async () => {
    const requester = buildRequestUser({ role: "MANAGER" });
    await expect(
      useCase.execute(requester, { ...baseInput, type: "ANNOUNCEMENT", assigneeId: "user-2" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee doesn't exist", async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute(buildRequestUser(), { ...baseInput, assigneeId: "missing" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee is not STAFF", async () => {
    userRepo.findById.mockResolvedValue(buildUser({ role: "MANAGER", shopId: null }));
    await expect(
      useCase.execute(buildRequestUser(), { ...baseInput, assigneeId: "user-2" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee belongs to a different shop", async () => {
    userRepo.findById.mockResolvedValue(buildUser({ role: "STAFF", shopId: "other-shop" }));
    await expect(
      useCase.execute(buildRequestUser(), { ...baseInput, assigneeId: "user-2" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the assignee is inactive", async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ role: "STAFF", shopId: "shop-1", isActive: false }),
    );
    await expect(
      useCase.execute(buildRequestUser(), { ...baseInput, assigneeId: "user-2" }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("accepts a valid active STAFF assignee in the same shop", async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ role: "STAFF", shopId: "shop-1", isActive: true }),
    );
    await expect(
      useCase.execute(buildRequestUser(), { ...baseInput, assigneeId: "user-2" }),
    ).resolves.toBeDefined();
  });

  it("forces requiresAck to false for ISSUE regardless of input", async () => {
    await useCase.execute(buildRequestUser(), { ...baseInput, requiresAck: true });
    expect(ticketRepo.createWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requiresAck: false }),
    );
  });

  it("defaults requiresAck to true for INSTRUCTION when not specified", async () => {
    const requester = buildRequestUser({ role: "MANAGER" });
    await useCase.execute(requester, { ...baseInput, type: "INSTRUCTION" });
    expect(ticketRepo.createWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requiresAck: true }),
    );
  });

  it("respects an explicit requiresAck: false on INSTRUCTION", async () => {
    const requester = buildRequestUser({ role: "MANAGER" });
    await useCase.execute(requester, { ...baseInput, type: "INSTRUCTION", requiresAck: false });
    expect(ticketRepo.createWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requiresAck: false }),
    );
  });

  it("defaults priority to NORMAL when not given", async () => {
    await useCase.execute(buildRequestUser(), baseInput);
    expect(ticketRepo.createWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "NORMAL" }),
    );
  });

  it("passes clientMessageId through to the repository for idempotency", async () => {
    await useCase.execute(buildRequestUser(), baseInput);
    expect(ticketRepo.createWithInitialMessage).toHaveBeenCalledWith(
      expect.objectContaining({ clientMessageId: "client-key-1" }),
    );
  });

  it("emits TICKET_CREATED with the created ticket's fields", async () => {
    const ticket = buildTicket({ id: "ticket-9" });
    ticketRepo.createWithInitialMessage.mockResolvedValue({
      ticket,
      message: buildTicketMessage(),
    });
    await useCase.execute(buildRequestUser(), baseInput);
    expect(events.emit).toHaveBeenCalledWith(
      "ticket:created",
      expect.objectContaining({
        ticketId: "ticket-9",
        shopId: ticket.shopId,
        type: ticket.type,
        subject: ticket.subject,
        priority: ticket.priority,
      }),
    );
  });

  it("returns the ticket and message from the repository", async () => {
    const result = await useCase.execute(buildRequestUser(), baseInput);
    expect(result).toHaveProperty("ticket");
    expect(result).toHaveProperty("message");
  });
});
