// use-cases/__tests__/create-delivery.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildDelivery } from "../../../../test/fixtures/delivery.fixture";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { CreateDeliveryUseCase } from "../create-delivery.use-case";

describe("CreateDeliveryUseCase", () => {
  let shopRepository: any;
  let supplierRepository: any;
  let deliveryRepository: any;
  let useCase: CreateDeliveryUseCase;

  const input = {
    requesterId: "staff-1",
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    shopId: "shop-1",
    supplierId: "supplier-1",
    lineItems: [
      {
        productName: "Bread",
        quantityOrdered: 20,
        quantityReceived: 20,
        unit: "loaf",
        unitPriceCents: 500,
      },
    ],
  };

  beforeEach(() => {
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };
    supplierRepository = {
      findById: vi.fn().mockResolvedValue(buildSupplier({ id: "supplier-1", shopId: "shop-1" })),
    };
    deliveryRepository = {
      createWithLineItems: vi.fn().mockResolvedValue(buildDelivery()),
    };
    useCase = new CreateDeliveryUseCase(shopRepository, supplierRepository, deliveryRepository, {
      emit: vi.fn(),
    } as any);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(useCase.execute({ ...input, requesterShopId: "other-shop" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("throws NotFoundError when the shop doesn't exist or is inactive", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the supplier doesn't exist", async () => {
    supplierRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when the supplier belongs to a different shop", async () => {
    supplierRepository.findById.mockResolvedValue(
      buildSupplier({ id: "supplier-1", shopId: "some-other-shop" }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when the supplier is deactivated", async () => {
    supplierRepository.findById.mockResolvedValue(
      buildSupplier({ id: "supplier-1", shopId: "shop-1", isActive: false }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when lineItems is empty", async () => {
    await expect(useCase.execute({ ...input, lineItems: [] })).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when quantityReceived is negative", async () => {
    await expect(
      useCase.execute({
        ...input,
        lineItems: [{ ...input.lineItems[0]!, quantityReceived: -1 }],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("computes lineTotalCents from quantityReceived, not quantityOrdered", async () => {
    await useCase.execute({
      ...input,
      lineItems: [
        {
          productName: "Bread",
          quantityOrdered: 20,
          quantityReceived: 18,
          unit: "loaf",
          unitPriceCents: 500,
        },
      ],
    });
    const createArgs = deliveryRepository.createWithLineItems.mock.calls[0][0];
    expect(createArgs.lineItems[0].lineTotalCents).toBe(9_000); // 18 * 500, not 20 * 500
  });

  it("sums totalAmountCents across all line items", async () => {
    await useCase.execute({
      ...input,
      lineItems: [
        {
          productName: "Bread",
          quantityOrdered: 20,
          quantityReceived: 20,
          unit: "loaf",
          unitPriceCents: 500,
        },
        {
          productName: "Milk",
          quantityOrdered: 10,
          quantityReceived: 10,
          unit: "carton",
          unitPriceCents: 200,
        },
      ],
    });
    const createArgs = deliveryRepository.createWithLineItems.mock.calls[0][0];
    expect(createArgs.totalAmountCents).toBe(10_000 + 2_000);
  });

  it("returns a delivery that starts unpaid", async () => {
    const result = await useCase.execute(input);
    expect(result.totalPaidCents).toBe(0);
    expect(result.paymentStatus).toBe("UNPAID");
  });
});
