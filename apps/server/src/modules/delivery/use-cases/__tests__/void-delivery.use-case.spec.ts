// use-cases/__tests__/void-delivery.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildDeliveryWithRelations } from "../../../../test/fixtures/delivery.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { VoidDeliveryUseCase } from "../void-delivery.use-case";

describe("VoidDeliveryUseCase", () => {
  let deliveryRepository: any;
  let useCase: VoidDeliveryUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    deliveryId: "delivery-1",
    voidReason: "wrong supplier",
  };

  beforeEach(() => {
    deliveryRepository = { findById: vi.fn(), voidIfUnencumbered: vi.fn() };
    useCase = new VoidDeliveryUseCase(deliveryRepository);
    deliveryRepository.findById
      .mockResolvedValueOnce(buildDeliveryWithRelations({ id: "delivery-1", payments: [] })) // initial read
      .mockResolvedValueOnce(
        buildDeliveryWithRelations({ id: "delivery-1", voidedAt: new Date() }),
      ); // post-void refresh
    deliveryRepository.voidIfUnencumbered.mockResolvedValue(1);
  });

  it("throws NotFoundError when the delivery doesn't exist", async () => {
    deliveryRepository.findById = vi.fn().mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError (pre-check) when already voided", async () => {
    deliveryRepository.findById = vi
      .fn()
      .mockResolvedValue(buildDeliveryWithRelations({ voidedAt: new Date() }));
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when voidIfUnencumbered returns 0 (live payments or already voided at write time)", async () => {
    deliveryRepository.voidIfUnencumbered.mockResolvedValue(0);
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("delegates the atomic guard to the repository rather than checking payments in memory", async () => {
    await useCase.execute(input);
    expect(deliveryRepository.voidIfUnencumbered).toHaveBeenCalledWith(
      "delivery-1",
      "owner-1",
      "wrong supplier",
    );
  });

  it("returns the refreshed, now-voided delivery", async () => {
    const result = await useCase.execute(input);
    expect(result.voidedAt).not.toBeNull();
  });
});
