// modules/ticket/use-cases/__tests__/get-ticket-by-id.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { GetTicketByIdUseCase } from "../get-ticket-by-id.use-case";

describe("GetTicketByIdUseCase", () => {
  let ticketRepo: any;
  let messageRepo: any;
  let useCase: GetTicketByIdUseCase;

  beforeEach(() => {
    ticketRepo = { findByIdOrThrow: vi.fn().mockResolvedValue(buildTicket({ shopId: "shop-1" })) };
    messageRepo = { findRecentByTicketId: vi.fn().mockResolvedValue([]) };
    useCase = new GetTicketByIdUseCase(ticketRepo, messageRepo);
  });

  it("throws AuthorizationError when STAFF views a different shop's ticket", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1", 20)).rejects.toThrow(AuthorizationError);
  });

  it("allows MANAGER to view any shop's ticket", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1", 20)).resolves.toBeDefined();
  });

  it("propagates NotFoundError from the repository", async () => {
    ticketRepo.findByIdOrThrow.mockRejectedValue(new Error("not found"));
    await expect(useCase.execute(buildRequestUser(), "missing", 20)).rejects.toThrow();
  });

  it("passes the recentMessages limit through to the message repository", async () => {
    await useCase.execute(buildRequestUser({ role: "STAFF", shopId: "shop-1" }), "ticket-1", 30);
    expect(messageRepo.findRecentByTicketId).toHaveBeenCalledWith("ticket-1", 30);
  });

  it("returns the ticket and messages together", async () => {
    const result = await useCase.execute(
      buildRequestUser({ role: "STAFF", shopId: "shop-1" }),
      "ticket-1",
      20,
    );
    expect(result).toHaveProperty("ticket");
    expect(result).toHaveProperty("messages");
  });
});
