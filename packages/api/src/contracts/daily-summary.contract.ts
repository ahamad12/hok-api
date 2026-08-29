import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const dailySummaryStatus = z.enum(["DRAFT", "FINALIZED"]);

const breakdownSchema = z.object({
  tillByCategory: z.record(z.string(), z.number().int()), // { SALES: 12000, EXPENSE: 3000, ... }
  scratchByGame: z.array(
    z.object({
      gameId: z.string().uuid(),
      ticketsSold: z.number().int(),
      revenueCents: z.number().int(),
    }),
  ),
  deliveryBySupplier: z.array(
    z.object({
      supplierId: z.string().uuid(),
      totalAmountCents: z.number().int(),
      totalPaidCents: z.number().int(),
    }),
  ),
  expenseByCategory: z.array(
    z.object({ categoryId: z.string().uuid(), amountCents: z.number().int() }),
  ),
});

const dailySummarySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  date: z.coerce.date(),
  status: dailySummaryStatus,
  openingBalance: z.number().int(),
  closingBalance: z.number().int(),
  totalCashIn: z.number().int(),
  totalCashOut: z.number().int(),
  scratchRevenue: z.number().int(),
  deliveryExpense: z.number().int(),
  otherIncome: z.number().int(),
  otherExpense: z.number().int(),
  variance: z.number().int(),
  breakdown: breakdownSchema,
  notes: z.string().nullable(),
  createdById: z.string().uuid(),
  finalizedAt: z.coerce.date().nullable(),
  finalizedById: z.string().uuid().nullable(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const dailySummaryContract = c.router(
  {
    create: {
      method: "POST",
      path: "/daily-summaries",
      body: z.object({
        shopId: z.string().uuid(),
        date: z.coerce.date(),
        openingBalance: z.number().int().optional(),
        closingBalance: z.number().int(),
        notes: z.string().trim().max(1000).optional(),
      }),
      responses: {
        201: dailySummarySchema,
        409: z.object({ code: z.literal("CONFLICT"), message: z.string() }),
      },
    },
    getAll: {
      method: "GET",
      path: "/daily-summaries",
      query: z.object({
        shopId: z.string().uuid(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        status: dailySummaryStatus.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: { 200: z.object({ summaries: z.array(dailySummarySchema), total: z.number() }) },
    },
    // CHANGED — renamed from /daily-summaries/shop/:shopId/date/:date, and
    // registered before getById below. Both changes independently remove
    // the risk of Express matching "/shop" as a literal :id segment; the
    // rename also makes the route's purpose unambiguous at a glance.
    getByDate: {
      method: "GET",
      path: "/daily-summaries/by-date/:shopId/:date",
      responses: { 200: dailySummarySchema },
    },
    getById: {
      method: "GET",
      path: "/daily-summaries/:id",
      responses: { 200: dailySummarySchema },
    },
    finalize: {
      method: "POST",
      path: "/daily-summaries/:id/finalize",
      body: z.object({}),
      responses: { 200: dailySummarySchema },
    },
    void: {
      method: "POST",
      path: "/daily-summaries/:id/void",
      body: z.object({ voidReason: z.string().trim().min(3).max(500) }),
      responses: { 200: dailySummarySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
