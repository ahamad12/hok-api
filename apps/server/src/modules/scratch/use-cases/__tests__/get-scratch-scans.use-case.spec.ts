import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetScratchScansUseCase } from "../get-scratch-scans.use-case";

describe("GetScratchScansUseCase", () => {
  let scanRepo: { findByShopAndDate: ReturnType<typeof vi.fn> };
  let useCase: GetScratchScansUseCase;
  const date = new Date("2026-07-01");
  const shopId = TEST_TENANT_SHOP_IDS[0] as string;
  const base = {
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId,
    date,
  };

  beforeEach(() => {
    scanRepo = { findByShopAndDate: vi.fn().mockResolvedValue([]) };
    useCase = new GetScratchScansUseCase(scanRepo as any);
  });

  it("rejects STAFF reading another shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
    expect(scanRepo.findByShopAndDate).not.toHaveBeenCalled();
  });

  it("rejects an OWNER for a shop outside their tenant", async () => {
    await expect(useCase.execute({ ...base, shopId: "foreign-shop" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("lets STAFF read their own shop for the given day", async () => {
    await useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: shopId });
    expect(scanRepo.findByShopAndDate).toHaveBeenCalledWith(shopId, date);
  });

  it("maps scans to the public shape, voided ones included", async () => {
    scanRepo.findByShopAndDate.mockResolvedValue([
      {
        id: "scan-1",
        packId: "pack-1",
        gameId: "game-1",
        shopId,
        sequenceNumber: 7,
        scanDate: date,
        shiftPeriod: "MORNING",
        scannedSerial: "010",
        ticketsSoldSincePrevious: 10,
        ticketsRemaining: 40,
        unitPriceCents: 500,
        revenueCents: 5000,
        scannedById: "user-1",
        voidedAt: new Date("2026-07-01T10:00:00Z"),
        voidedById: "owner-1",
        voidReason: "wrong pack",
        createdAt: date,
      },
    ]);
    const { scans } = await useCase.execute(base);
    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({
      id: "scan-1",
      shiftPeriod: "MORNING",
      voidReason: "wrong pack",
    });
    expect(scans[0]).not.toHaveProperty("sequenceNumber");
  });
});
