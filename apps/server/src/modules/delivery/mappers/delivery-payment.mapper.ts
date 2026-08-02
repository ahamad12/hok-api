// modules/delivery/mappers/delivery-payment.mapper.ts
import type { DeliveryPayment } from "@tapt-api/db";

export type DeliveryPaymentResult = Pick<
  DeliveryPayment,
  | "id"
  | "deliveryId"
  | "amountCents"
  | "paymentMode"
  | "paidAt"
  | "recordedById"
  | "notes"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
>;

export function toDeliveryPaymentResult(payment: DeliveryPayment): DeliveryPaymentResult {
  const {
    id,
    deliveryId,
    amountCents,
    paymentMode,
    paidAt,
    recordedById,
    notes,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  } = payment;
  return {
    id,
    deliveryId,
    amountCents,
    paymentMode,
    paidAt,
    recordedById,
    notes,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
  };
}
