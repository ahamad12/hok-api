// use-cases/__tests__/get-delivery-by-id.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { buildDeliveryWithRelations } from "../../../../test/fixtures/delivery.fixture";
import { buildDeliveryLineItem } from "../../../../test/fixtures/delivery-line-item.fixture";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetDeliveryByIdUseCase } from "../get-delivery-by-id.use-case";

describe("GetDeliveryByIdUseCase", () => {
  let deliveryRepository: any;
  let useCase: GetDeliveryByIdUseCase;

  beforeEach(() => {
    deliveryRepository = { findById: vi.fn() };
    useCase = new GetDeliveryByIdUseCase(deliveryRepository);
  });

  it("throws NotFoundError when the delivery doesn't exist", async () => {
    deliveryRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        deliveryId: "missing",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests a different shop's delivery", async () => {
    deliveryRepository.findById.mockResolvedValue(buildDeliveryWithRelations({ shopId: "shop-1" }));
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-2",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        deliveryId: "delivery-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("returns the delivery alongside its mapped line items and payments", async () => {
    deliveryRepository.findById.mockResolvedValue(
      buildDeliveryWithRelations({
        shopId: "shop-1",
        lineItems: [buildDeliveryLineItem()],
        payments: [buildDeliveryPayment()],
      }),
    );
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
      deliveryId: "delivery-1",
    });
    expect(result.lineItems).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
  });
});
