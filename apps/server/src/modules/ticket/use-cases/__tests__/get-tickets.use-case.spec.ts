// modules/ticket/use-cases/__tests__/get-tickets.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { GetTicketsUseCase } from "../get-tickets.use-case";

describe("GetTicketsUseCase", () => {
  let ticketRepo: any;
  let useCase: GetTicketsUseCase;

  beforeEach(() => {
    ticketRepo = { findAll: vi.fn().mockResolvedValue({ tickets: [], total: 0 }) };
    useCase = new GetTicketsUseCase(ticketRepo);
  });

  it("throws AuthorizationError when STAFF queries a different shop", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { shopId: "shop-2", limit: 20, offset: 0 }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows MANAGER to query any shop", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "shop-1" });
    await expect(
      useCase.execute(requester, { shopId: "shop-2", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("allows OWNER to query any shop", async () => {
    const requester = buildRequestUser({ role: "OWNER", shopId: null });
    await expect(
      useCase.execute(requester, { shopId: "shop-2", limit: 20, offset: 0 }),
    ).resolves.toBeDefined();
  });

  it("delegates the query as-is to the repository", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    const query = { shopId: "shop-1", type: "ISSUE" as const, limit: 20, offset: 0 };
    await useCase.execute(requester, query);
    expect(ticketRepo.findAll).toHaveBeenCalledWith(query);
  });
});
