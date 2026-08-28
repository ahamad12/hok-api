// modules/ticket/use-cases/__tests__/get-messages.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { GetMessagesUseCase } from "../get-messages.use-case";

describe("GetMessagesUseCase", () => {
  let ticketRepo: any;
  let messageRepo: any;
  let useCase: GetMessagesUseCase;

  beforeEach(() => {
    ticketRepo = { findByIdOrThrow: vi.fn().mockResolvedValue(buildTicket({ shopId: "shop-1" })) };
    messageRepo = { findPage: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }) };
    useCase = new GetMessagesUseCase(ticketRepo, messageRepo);
  });

  it("throws AuthorizationError when STAFF views a different shop's ticket", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-2" });
    await expect(useCase.execute(requester, "ticket-1", { limit: 50 })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows OWNER/MANAGER regardless of shop", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(useCase.execute(requester, "ticket-1", { limit: 50 })).resolves.toBeDefined();
  });

  it("passes since/limit through to the message repository unchanged", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await useCase.execute(requester, "ticket-1", { since: 42, limit: 50 });
    expect(messageRepo.findPage).toHaveBeenCalledWith("ticket-1", { since: 42, limit: 50 });
  });

  it("returns messages and nextCursor from the repository", async () => {
    messageRepo.findPage.mockResolvedValue({ messages: [{}], nextCursor: 99 });
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    const result = await useCase.execute(requester, "ticket-1", { limit: 50 });
    expect(result).toEqual({ messages: [{}], nextCursor: 99 });
  });
});
