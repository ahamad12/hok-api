// use-cases/__tests__/get-supplier-outstanding.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { GetSupplierOutstandingUseCase } from "../get-supplier-outstanding.use-case";

describe("GetSupplierOutstandingUseCase", () => {
  let deliveryRepository: any;
  let useCase: GetSupplierOutstandingUseCase;

  beforeEach(() => {
    deliveryRepository = { getSupplierBalances: vi.fn().mockResolvedValue([]) };
    useCase = new GetSupplierOutstandingUseCase(deliveryRepository);
  });

  it("throws AuthorizationError when STAFF requests a different shop's balances", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.STAFF,
        requesterShopId: "other-shop",
        shopId: "shop-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("computes outstandingCents as totalAmountCents minus totalPaidCents per supplier", async () => {
    deliveryRepository.getSupplierBalances.mockResolvedValue([
      { supplierId: "supplier-1", totalAmountCents: 10_000, totalPaidCents: 4_000 },
    ]);
    const result = await useCase.execute({
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      shopId: "shop-1",
    });
    expect(result.balances).toEqual([
      {
        supplierId: "supplier-1",
        totalAmountCents: 10_000,
        totalPaidCents: 4_000,
        outstandingCents: 6_000,
      },
    ]);
  });
});
