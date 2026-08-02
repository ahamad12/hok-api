// use-cases/__tests__/get-deliveries.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { buildDelivery } from "../../../../test/fixtures/delivery.fixture";
import { GetDeliveriesUseCase } from "../get-deliveries.use-case";

describe("GetDeliveriesUseCase", () => {
  let deliveryRepository: any;
  let useCase: GetDeliveriesUseCase;
  const base = {
    requesterRole: UserRole.MANAGER,
    requesterShopId: null,
    shopId: "shop-1",
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    deliveryRepository = { findAll: vi.fn().mockResolvedValue({ deliveries: [], total: 0 }) };
    useCase = new GetDeliveriesUseCase(deliveryRepository);
  });

  it("throws AuthorizationError when STAFF requests a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("filters mapped results by paymentStatus when requested", async () => {
    deliveryRepository.findAll.mockResolvedValue({
      deliveries: [
        buildDelivery({ id: "d1", totalAmountCents: 10_000, totalPaidCents: 10_000 }), // PAID
        buildDelivery({ id: "d2", totalAmountCents: 10_000, totalPaidCents: 0 }), // UNPAID
      ],
      total: 2,
    });
    const result = await useCase.execute({ ...base, paymentStatus: "PAID" });
    expect(result.deliveries.map((d) => d.id)).toEqual(["d1"]);
  });

  it("passes through when no paymentStatus filter is given", async () => {
    deliveryRepository.findAll.mockResolvedValue({
      deliveries: [buildDelivery({ id: "d1" })],
      total: 1,
    });
    const result = await useCase.execute(base);
    expect(result.deliveries).toHaveLength(1);
  });
});
