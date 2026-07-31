// modules/scratch/use-cases/__tests__/get-scratch-sales-summary.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { GetScratchSalesSummaryUseCase } from "../get-scratch-sales-summary.use-case";

describe("GetScratchSalesSummaryUseCase", () => {
  let scanRepo: { getSummaryByGame: ReturnType<typeof vi.fn> };
  let useCase: GetScratchSalesSummaryUseCase;
  const base = {
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    shopId: "shop-1",
    dateFrom: new Date("2026-07-01"),
    dateTo: new Date("2026-07-31"),
  };

  beforeEach(() => {
    scanRepo = { getSummaryByGame: vi.fn().mockResolvedValue([]) };
    useCase = new GetScratchSalesSummaryUseCase(scanRepo as any);
  });

  it("throws AuthorizationError for STAFF on a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("sums totalTicketsSold and totalRevenueCents across all games in byGame", async () => {
    scanRepo.getSummaryByGame.mockResolvedValue([
      { gameId: "game-1", ticketsSold: 10, revenueCents: 5000 },
      { gameId: "game-2", ticketsSold: 4, revenueCents: 4000 },
    ]);
    const result = await useCase.execute(base);
    expect(result.totalTicketsSold).toBe(14);
    expect(result.totalRevenueCents).toBe(9000);
    expect(result.byGame).toHaveLength(2);
  });

  it("returns zero totals when there is no scan activity in the range", async () => {
    const result = await useCase.execute(base);
    expect(result).toMatchObject({ totalTicketsSold: 0, totalRevenueCents: 0, byGame: [] });
  });
});
