// modules/delivery/mappers/delivery.mapper.ts
import type { Delivery } from "@tapt-api/db";

export type DeliveryPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type DeliveryResult = Pick<
  Delivery,
  | "id"
  | "shopId"
  | "supplierId"
  | "billUrl"
  | "totalAmountCents"
  | "totalPaidCents"
  | "deliveredById"
  | "deliveredAt"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
  | "updatedAt"
> & {
  balanceDueCents: number;
  paymentStatus: DeliveryPaymentStatus;
};

export function toDeliveryResult(delivery: Delivery): DeliveryResult {
  const {
    id,
    shopId,
    supplierId,
    billUrl,
    totalAmountCents,
    totalPaidCents,
    deliveredById,
    deliveredAt,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  } = delivery;

  const balanceDueCents = totalAmountCents - totalPaidCents;
  const paymentStatus: DeliveryPaymentStatus =
    totalPaidCents <= 0 ? "UNPAID" : balanceDueCents <= 0 ? "PAID" : "PARTIAL";

  return {
    id,
    shopId,
    supplierId,
    billUrl,
    totalAmountCents,
    totalPaidCents,
    deliveredById,
    deliveredAt,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
    balanceDueCents,
    paymentStatus,
  };
}
