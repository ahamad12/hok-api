// packages/api/src/contracts/delivery.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const deliveryLineItemSchema = z.object({
  id: z.string().uuid(),
  deliveryId: z.string().uuid(),
  productName: z.string(),
  quantityOrdered: z.number(),
  quantityReceived: z.number(),
  unit: z.string(),
  unitPriceCents: z.number().int(),
  lineTotalCents: z.number().int(),
  discrepancyNote: z.string().nullable(),
  hasDiscrepancy: z.boolean(),
  createdAt: z.coerce.date(),
});

const deliveryPaymentSchema = z.object({
  id: z.string().uuid(),
  deliveryId: z.string().uuid(),
  amountCents: z.number().int(),
  paymentMode: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  paidAt: z.coerce.date(),
  recordedById: z.string().uuid(),
  notes: z.string().nullable(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const deliveryStatusSchema = z.enum(["PENDING", "RECEIVED"]);

const deliverySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  supplierId: z.string().uuid(),
  billUrl: z.string().nullable(),
  totalAmountCents: z.number().int(),
  totalPaidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
  status: deliveryStatusSchema,
  receivedAt: z.coerce.date().nullable(),
  receivedById: z.string().uuid().nullable(),
  deliveredById: z.string().uuid(),
  deliveredAt: z.coerce.date(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const createLineItemBodySchema = z.object({
  productName: z.string().trim().min(1).max(200),
  quantityOrdered: z.number().positive(),
  quantityReceived: z.number().nonnegative(),
  unit: z.string().trim().min(1).max(50),
  unitPriceCents: z.number().int().positive(),
  discrepancyNote: z.string().trim().max(500).optional(),
});

const supplierOutstandingSchema = z.object({
  supplierId: z.string().uuid(),
  totalAmountCents: z.number().int(),
  totalPaidCents: z.number().int(),
  outstandingCents: z.number().int(),
});

const voidBodySchema = z.object({
  voidReason: z.string().trim().min(3).max(500),
});

export const deliveryContract = c.router(
  {
    create: {
      method: "POST",
      path: "/deliveries",
      body: z.object({
        shopId: z.string().uuid(),
        supplierId: z.string().uuid(),
        billUrl: z.string().url().optional(),
        deliveredAt: z.coerce.date().optional(),
        lineItems: z.array(createLineItemBodySchema).min(1),
        // Check in at once (lines locked, counted, payable). Default:
        // PENDING, so the lines can still be fixed while counting stock.
        receiveNow: z.boolean().optional(),
      }),
      responses: { 201: deliverySchema },
    },
    getAll: {
      method: "GET",
      path: "/deliveries",
      query: z.object({
        shopId: z.string().uuid(),
        supplierId: z.string().uuid().optional(),
        isVoided: z.coerce.boolean().optional(),
        paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]).optional(),
        status: deliveryStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: {
        200: z.object({ deliveries: z.array(deliverySchema), total: z.number().int() }),
      },
    },
    // MUST be registered before getById — Express-style path matching,
    // "/deliveries/supplier-outstanding" would otherwise be swallowed by "/deliveries/:id"
    getSupplierOutstanding: {
      method: "GET",
      path: "/deliveries/supplier-outstanding",
      query: z.object({ shopId: z.string().uuid() }),
      responses: { 200: z.object({ balances: z.array(supplierOutstandingSchema) }) },
    },
    getById: {
      method: "GET",
      path: "/deliveries/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: z.object({
          delivery: deliverySchema,
          lineItems: z.array(deliveryLineItemSchema),
          payments: z.array(deliveryPaymentSchema),
        }),
      },
    },
    // Only while PENDING and unpaid. lineItems replaces every line.
    update: {
      method: "PATCH",
      path: "/deliveries/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z
        .object({
          supplierId: z.string().uuid().optional(),
          deliveredAt: z.coerce.date().optional(),
          lineItems: z.array(createLineItemBodySchema).min(1).optional(),
        })
        .refine((b) => Object.values(b).some((v) => v !== undefined), {
          message: "Nothing to update",
        }),
      responses: { 200: deliverySchema },
    },
    // Check in: PENDING -> RECEIVED. Locks the lines; counts in day totals.
    receive: {
      method: "POST",
      path: "/deliveries/:id/receive",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: deliverySchema },
    },
    // Invoice photo or PDF, multipart field "file". Replaces billUrl.
    uploadBill: {
      method: "POST",
      path: "/deliveries/:id/bill",
      pathParams: z.object({ id: z.string().uuid() }),
      contentType: "multipart/form-data",
      body: c.type<{ file: unknown }>(),
      responses: { 200: deliverySchema },
    },
    recordPayment: {
      method: "POST",
      path: "/deliveries/:id/payments",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({
        amountCents: z.number().int().positive(),
        paymentMode: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
        paidAt: z.coerce.date().optional(),
        notes: z.string().trim().max(500).optional(),
      }),
      responses: { 201: z.object({ delivery: deliverySchema, payment: deliveryPaymentSchema }) },
    },
    voidPayment: {
      method: "POST",
      path: "/deliveries/payments/:paymentId/void",
      pathParams: z.object({ paymentId: z.string().uuid() }),
      body: voidBodySchema,
      responses: { 200: z.object({ delivery: deliverySchema, payment: deliveryPaymentSchema }) },
    },
    voidDelivery: {
      method: "POST",
      path: "/deliveries/:id/void",
      pathParams: z.object({ id: z.string().uuid() }),
      body: voidBodySchema,
      responses: { 200: deliverySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
