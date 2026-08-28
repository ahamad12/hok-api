// modules/ticket/use-cases/__tests__/get-acknowledgements.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "../../../../common/errors";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { buildTicket } from "../../../../test/fixtures/ticket.fixture";
import { GetAcknowledgementsUseCase } from "../get-acknowledgements.use-case";

describe("GetAcknowledgementsUseCase", () => {
  let ticketRepo: any;
  let userRepo: any;
  let ackRepo: any;
  let useCase: GetAcknowledgementsUseCase;

  beforeEach(() => {
    ticketRepo = {
      findByIdOrThrow: vi
        .fn()
        .mockResolvedValue(
          buildTicket({ type: "ANNOUNCEMENT", shopId: "shop-1", createdById: "creator-1" }),
        ),
    };
    userRepo = {
      findActiveByShop: vi.fn().mockResolvedValue([
        { id: "user-2", displayName: "Staff Two" },
        { id: "user-3", displayName: "Staff Three" },
      ]),
    };
    ackRepo = {
      findByTicketId: vi.fn().mockResolvedValue(new Map([["user-2", new Date("2026-01-02")]])),
    };
    useCase = new GetAcknowledgementsUseCase(ticketRepo, userRepo, ackRepo);
  });

  it("throws BusinessRuleError for an ISSUE ticket", async () => {
    ticketRepo.findByIdOrThrow.mockResolvedValue(buildTicket({ type: "ISSUE" }));
    await expect(useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1")).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws AuthorizationError for STAFF regardless of shop", async () => {
    await expect(useCase.execute(buildRequestUser({ role: "STAFF" }), "ticket-1")).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows MANAGER to view the roster for a shop that is not their own", async () => {
    const requester = buildRequestUser({ role: "MANAGER", shopId: "other-shop" });
    await expect(useCase.execute(requester, "ticket-1")).resolves.toBeDefined();
  });

  it("excludes the ticket creator from the audience lookup", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1");
    expect(userRepo.findActiveByShop).toHaveBeenCalledWith("shop-1", "creator-1");
  });

  it("marks acknowledgedAt null for a member who has not acknowledged", async () => {
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1");
    const staffThree = result.audience.find((a: any) => a.userId === "user-3");
    expect(staffThree.acknowledgedAt).toBeNull();
  });

  it("carries through the timestamp for a member who has acknowledged", async () => {
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1");
    const staffTwo = result.audience.find((a: any) => a.userId === "user-2");
    expect(staffTwo.acknowledgedAt).toEqual(new Date("2026-01-02"));
  });

  it("computes totalAudience and acknowledgedCount correctly", async () => {
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1");
    expect(result.totalAudience).toBe(2);
    expect(result.acknowledgedCount).toBe(1);
  });

  it("reports acknowledgedCount 0 when nobody has acknowledged yet", async () => {
    ackRepo.findByTicketId.mockResolvedValue(new Map());
    const result = await useCase.execute(buildRequestUser({ role: "OWNER" }), "ticket-1");
    expect(result.acknowledgedCount).toBe(0);
  });
});
