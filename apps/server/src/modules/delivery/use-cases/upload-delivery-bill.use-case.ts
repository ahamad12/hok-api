// modules/delivery/use-cases/upload-delivery-bill.use-case.ts
import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../../common/errors";
import { StorageService } from "../../../infra/storage/storage.service";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export const MAX_BILL_BYTES = 10 * 1024 * 1024;
const BILL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export interface UploadedBillFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface UploadDeliveryBillInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  deliveryId: string;
  file: UploadedBillFile | undefined;
}

/**
 * Stores the supplier's invoice (photo or PDF) in Cloudinary and saves its
 * URL on the delivery. Allowed in any status, since a bill often turns up
 * after check-in. Anyone in the shop.
 */
@Injectable()
export class UploadDeliveryBillUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(input: UploadDeliveryBillInput): Promise<DeliveryResult> {
    const { file } = input;
    if (!file) throw new ValidationError("Attach the bill as the 'file' field", "file");
    if (!BILL_TYPES.has(file.mimetype)) {
      throw new ValidationError("The bill must be a JPEG, PNG, WebP, HEIC or PDF", "file");
    }
    if (file.size > MAX_BILL_BYTES) {
      throw new ValidationError("The bill must be 10 MB or smaller", "file");
    }

    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);
    if (!canAccessShop(requesterScope(input), delivery.shopId)) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt) throw new BusinessRuleError("Cannot attach a bill to a voided delivery");

    const uploaded = await this.storage.upload(file.buffer, {
      folder: `tapt/deliveries/${delivery.shopId}`,
      resource_type: "auto",
    });

    const count = await this.deliveryRepository.setBillUrlIfNotVoided(
      delivery.id,
      uploaded.secure_url,
    );
    if (count === 0) {
      // Voided meanwhile: don't leave an orphaned file behind.
      await this.storage.delete(uploaded.public_id).catch(() => undefined);
      throw new BusinessRuleError("This delivery was voided meanwhile");
    }

    const refreshed = await this.deliveryRepository.findById(delivery.id);
    if (!refreshed) throw new NotFoundError("Delivery", delivery.id);
    return toDeliveryResult(refreshed);
  }
}
