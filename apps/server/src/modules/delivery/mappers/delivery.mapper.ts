// modules/delivery/mappers/delivery.mapper.ts
import type { Delivery } from "@tapt-api/db";

export type DeliveryPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

/**
 * Derives a delivery's payment status from its balance columns. Single
 * source of truth for the UNPAID/PARTIAL/PAID classification so
 * `findAll`'s in-memory filter and DTO mapping can't drift out of sync.
 *
 * Relies on the invariant enforced by `recordPaymentIfWithinBalance`'s
 * `lte: totalAmountCents - amountCents` guard: totalPaidCents can never
 * legitimately exceed totalAmountCents, so PAID and PARTIAL are mutually
 * exclusive and exhaustive alongside UNPAID.
 */
export function getDeliveryPaymentStatus(
  delivery: Pick<Delivery, "totalAmountCents" | "totalPaidCents">,
): DeliveryPaymentStatus {
  if (delivery.totalPaidCents <= 0) return "UNPAID";
  if (delivery.totalAmountCents - delivery.totalPaidCents <= 0) return "PAID";
  return "PARTIAL";
}

export type DeliveryResult = Pick<
  Delivery,
  | "id"
  | "shopId"
  | "supplierId"
  | "billUrl"
  | "totalAmountCents"
  | "totalPaidCents"
  | "status"
  | "receivedAt"
  | "receivedById"
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
    status,
    receivedAt,
    receivedById,
    deliveredById,
    deliveredAt,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  } = delivery;

  const balanceDueCents = totalAmountCents - totalPaidCents;
  const paymentStatus = getDeliveryPaymentStatus(delivery);

  return {
    id,
    shopId,
    supplierId,
    billUrl,
    totalAmountCents,
    totalPaidCents,
    status,
    receivedAt,
    receivedById,
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
