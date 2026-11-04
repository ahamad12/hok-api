import { z } from "zod";
import type { SocketEventName } from "./event-names";
import { SOCKET_EVENTS } from "./event-names";

const taskStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"]);
const ticketStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const tillEntryTypeSchema = z.enum(["CASH_IN", "CASH_OUT"]);

export const taskAssignedPayloadSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string(),
  assigneeId: z.string().uuid(),
});

export const taskUpdatedPayloadSchema = z.object({
  taskId: z.string().uuid(),
  status: taskStatusSchema,
});

export const ticketCreatedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  shopId: z.string().uuid(),
  type: z.enum(["ISSUE", "INSTRUCTION", "ANNOUNCEMENT"]),
  subject: z.string(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

export const ticketUpdatedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  status: ticketStatusSchema,
});

export const ticketMessageCreatedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  shopId: z.string().uuid(),
  senderId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
  message: z.string().optional(),
  senderName: z.string().optional(),
});

export const ticketStatusChangedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  shopId: z.string().uuid(),
  type: z.enum(["ISSUE", "INSTRUCTION", "ANNOUNCEMENT"]),
  from: ticketStatusSchema,
  to: ticketStatusSchema,
});

export const ticketAssignedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  subject: z.string(),
});

export const ticketAcknowledgedPayloadSchema = z.object({
  ticketId: z.string().uuid(),
  userId: z.string().uuid(),
  acknowledgedAt: z.coerce.date(),
});

export const tillEntryCreatedPayloadSchema = z.object({
  entryId: z.string().uuid(),
  type: tillEntryTypeSchema,
  category: z.string(),
  amount: z.number().int(),
});

export const scratchSaleCreatedPayloadSchema = z.object({
  saleId: z.string().uuid(),
  cardName: z.string(),
  quantity: z.number().int().positive(),
  totalAmount: z.number().int(),
});

export const deliveryCreatedPayloadSchema = z.object({
  deliveryId: z.string().uuid(),
  shopId: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  lineItemCount: z.number().int(),
  totalAmountCents: z.number().int(),
});

export const dailySummaryFinalizedPayloadSchema = z.object({
  summaryId: z.string().uuid(),
  shopId: z.string().uuid(),
  date: z.coerce.date(),
  closingBalance: z.number().int(),
  variance: z.number().int(),
  finalizedById: z.string().uuid(),
});

export const dailySummaryVoidedPayloadSchema = z.object({
  summaryId: z.string().uuid(),
  shopId: z.string().uuid(),
  date: z.coerce.date(),
  voidedById: z.string().uuid(),
});

export const licenseExpiringPayloadSchema = z.object({
  licenseId: z.string().uuid(),
  productName: z.string(),
  expiryDate: z.coerce.date(),
  daysRemaining: z.number().int(),
});

export const profitReportGeneratedPayloadSchema = z.object({
  reportId: z.string().uuid(),
  shopId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  netProfit: z.number().int(),
  profitMargin: z.number(),
  generatedById: z.string().uuid(),
});

export const profitReportVoidedPayloadSchema = z.object({
  reportId: z.string().uuid(),
  shopId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  voidedById: z.string().uuid(),
});

export const formSubmittedPayloadSchema = z.object({
  formId: z.string().uuid(),
  shopId: z.string().uuid(),
  submissionId: z.string().uuid(),
  staffId: z.string().uuid(),
});

export const sessionRevokedPayloadSchema = z.object({
  message: z.string(),
});

export const socketEventSchemas = {
  [SOCKET_EVENTS.TASK_ASSIGNED]: taskAssignedPayloadSchema,
  [SOCKET_EVENTS.TASK_UPDATED]: taskUpdatedPayloadSchema,
  [SOCKET_EVENTS.TICKET_CREATED]: ticketCreatedPayloadSchema,
  [SOCKET_EVENTS.TICKET_UPDATED]: ticketUpdatedPayloadSchema,
  [SOCKET_EVENTS.TICKET_MESSAGE_CREATED]: ticketMessageCreatedPayloadSchema,
  [SOCKET_EVENTS.TICKET_STATUS_CHANGED]: ticketStatusChangedPayloadSchema,
  [SOCKET_EVENTS.TICKET_ASSIGNED]: ticketAssignedPayloadSchema,
  [SOCKET_EVENTS.TICKET_ACKNOWLEDGED]: ticketAcknowledgedPayloadSchema,
  [SOCKET_EVENTS.TILL_ENTRY_CREATED]: tillEntryCreatedPayloadSchema,
  [SOCKET_EVENTS.SCRATCH_SALE_CREATED]: scratchSaleCreatedPayloadSchema,
  [SOCKET_EVENTS.DELIVERY_CREATED]: deliveryCreatedPayloadSchema,
  [SOCKET_EVENTS.DAILY_SUMMARY_FINALIZED]: dailySummaryFinalizedPayloadSchema, // extended in place, not a new key
  [SOCKET_EVENTS.DAILY_SUMMARY_VOIDED]: dailySummaryVoidedPayloadSchema,
  [SOCKET_EVENTS.LICENSE_EXPIRING]: licenseExpiringPayloadSchema,
  [SOCKET_EVENTS.PROFIT_REPORT_GENERATED]: profitReportGeneratedPayloadSchema,
  [SOCKET_EVENTS.PROFIT_REPORT_VOIDED]: profitReportVoidedPayloadSchema,
  [SOCKET_EVENTS.FORM_SUBMITTED]: formSubmittedPayloadSchema,
  [SOCKET_EVENTS.SESSION_REVOKED]: sessionRevokedPayloadSchema,
} as const satisfies Record<SocketEventName, z.ZodTypeAny>;

export type SocketEventPayload<E extends SocketEventName> = z.infer<(typeof socketEventSchemas)[E]>;
