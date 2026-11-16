// use-cases/__tests__/check-in-delivery.use-cases.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../../common/errors";
import { buildDeliveryWithRelations } from "../../../../test/fixtures/delivery.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { ReceiveDeliveryUseCase } from "../receive-delivery.use-case";
import { RecordDeliveryPaymentUseCase } from "../record-delivery-payment.use-case";
import { UpdateDeliveryUseCase } from "../update-delivery.use-case";
import { UploadDeliveryBillUseCase } from "../upload-delivery-bill.use-case";

const staff = {
  requesterId: "staff-1",
  requesterRole: UserRole.STAFF,
  requesterShopId: "shop-1",
  requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
  deliveryId: "delivery-1",
};

const pending = (overrides = {}) =>
  buildDeliveryWithRelations({
    status: "PENDING",
    receivedAt: null,
    receivedById: null,
    ...overrides,
  });

const lineInput = {
  productName: "Milk",
  quantityOrdered: 10,
  quantityReceived: 8,
  unit: "crate",
  unitPriceCents: 250,
};

describe("UpdateDeliveryUseCase", () => {
  let deliveryRepository: any;
  let supplierRepository: any;
  let useCase: UpdateDeliveryUseCase;

  beforeEach(() => {
    deliveryRepository = {
      findById: vi.fn().mockResolvedValue(pending()),
      updateIfPending: vi.fn().mockResolvedValue(pending()),
    };
    supplierRepository = {
      findById: vi.fn().mockResolvedValue({ id: "supplier-2", shopId: "shop-1", isActive: true }),
    };
    useCase = new UpdateDeliveryUseCase(deliveryRepository, supplierRepository);
  });

  it("lets staff fix the lines of a pending delivery, pricing them from received quantity", async () => {
    await useCase.execute({ ...staff, lineItems: [lineInput] });
    expect(deliveryRepository.updateIfPending).toHaveBeenCalledWith("delivery-1", {
      supplierId: undefined,
      deliveredAt: undefined,
      lineItems: [expect.objectContaining({ lineTotalCents: 2_000, discrepancyNote: null })],
    });
  });

  it("refuses once the delivery is checked in", async () => {
    deliveryRepository.findById.mockResolvedValue(buildDeliveryWithRelations());
    await expect(useCase.execute({ ...staff, lineItems: [lineInput] })).rejects.toThrow(
      BusinessRuleError,
    );
    expect(deliveryRepository.updateIfPending).not.toHaveBeenCalled();
  });

  it("refuses a voided delivery", async () => {
    deliveryRepository.findById.mockResolvedValue(pending({ voidedAt: new Date() }));
    await expect(useCase.execute({ ...staff, supplierId: "supplier-2" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("refuses staff from another shop", async () => {
    await expect(
      useCase.execute({ ...staff, requesterShopId: "other-shop", supplierId: "supplier-2" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("refuses a supplier from another shop", async () => {
    supplierRepository.findById.mockResolvedValue({
      id: "supplier-2",
      shopId: "shop-9",
      isActive: true,
    });
    await expect(useCase.execute({ ...staff, supplierId: "supplier-2" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws NotFoundError for a missing delivery", async () => {
    deliveryRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ ...staff, supplierId: "supplier-2" })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("ReceiveDeliveryUseCase", () => {
  let deliveryRepository: any;
  let useCase: ReceiveDeliveryUseCase;

  beforeEach(() => {
    deliveryRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(pending())
        .mockResolvedValueOnce(buildDeliveryWithRelations()),
      receiveIfPending: vi.fn().mockResolvedValue(1),
    };
    useCase = new ReceiveDeliveryUseCase(deliveryRepository);
  });

  it("checks in a pending delivery as the requester", async () => {
    const result = await useCase.execute(staff);
    expect(deliveryRepository.receiveIfPending).toHaveBeenCalledWith("delivery-1", "staff-1");
    expect(result.status).toBe("RECEIVED");
  });

  it("refuses a delivery that is already checked in", async () => {
    deliveryRepository.findById = vi.fn().mockResolvedValue(buildDeliveryWithRelations());
    await expect(useCase.execute(staff)).rejects.toThrow(BusinessRuleError);
  });

  it("fails when a concurrent check-in or void wins the guarded write", async () => {
    deliveryRepository.receiveIfPending.mockResolvedValue(0);
    await expect(useCase.execute(staff)).rejects.toThrow(BusinessRuleError);
  });
});

describe("RecordDeliveryPaymentUseCase on a pending delivery", () => {
  it("refuses payment until the delivery is checked in", async () => {
    const deliveryRepository: any = {
      findById: vi.fn().mockResolvedValue(pending()),
      recordPaymentIfWithinBalance: vi.fn(),
    };
    const useCase = new RecordDeliveryPaymentUseCase(deliveryRepository);
    await expect(
      useCase.execute({
        ...staff,
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        amountCents: 1_000,
        paymentMode: "CASH",
      }),
    ).rejects.toThrow(BusinessRuleError);
    expect(deliveryRepository.recordPaymentIfWithinBalance).not.toHaveBeenCalled();
  });
});

describe("UploadDeliveryBillUseCase", () => {
  let deliveryRepository: any;
  let storage: any;
  let useCase: UploadDeliveryBillUseCase;
  const file = { buffer: Buffer.from("img"), mimetype: "image/jpeg", size: 3 };

  beforeEach(() => {
    deliveryRepository = {
      findById: vi.fn().mockResolvedValue(buildDeliveryWithRelations()),
      setBillUrlIfNotVoided: vi.fn().mockResolvedValue(1),
    };
    storage = {
      upload: vi
        .fn()
        .mockResolvedValue({ secure_url: "https://cdn.example/bill.jpg", public_id: "bill" }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new UploadDeliveryBillUseCase(deliveryRepository, storage);
  });

  it("uploads to the shop's folder and saves the URL, even after check-in", async () => {
    await useCase.execute({ ...staff, file });
    expect(storage.upload).toHaveBeenCalledWith(file.buffer, {
      folder: "tapt/deliveries/shop-1",
      resource_type: "auto",
    });
    expect(deliveryRepository.setBillUrlIfNotVoided).toHaveBeenCalledWith(
      "delivery-1",
      "https://cdn.example/bill.jpg",
    );
  });

  it("rejects a missing file, a wrong type and an oversized file before uploading", async () => {
    await expect(useCase.execute({ ...staff, file: undefined })).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...staff, file: { ...file, mimetype: "text/html" } }),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...staff, file: { ...file, size: 11 * 1024 * 1024 } }),
    ).rejects.toThrow(ValidationError);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("deletes the uploaded file when the delivery was voided meanwhile", async () => {
    deliveryRepository.setBillUrlIfNotVoided.mockResolvedValue(0);
    await expect(useCase.execute({ ...staff, file })).rejects.toThrow(BusinessRuleError);
    expect(storage.delete).toHaveBeenCalledWith("bill");
  });
});
