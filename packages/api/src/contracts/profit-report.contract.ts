import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const ProfitReportSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  scratchRevenue: z.number().int(),
  deliveryRevenue: z.number().int(),
  otherRevenue: z.number().int(),
  totalRevenue: z.number().int(),
  purchaseCost: z.number().int(),
  deliveryCost: z.number().int(),
  licenseFees: z.number().int(),
  salaryExpense: z.number().int(),
  utilityExpense: z.number().int(),
  rentExpense: z.number().int(),
  otherExpense: z.number().int(),
  totalExpense: z.number().int(),
  grossProfit: z.number().int(),
  netProfit: z.number().int(),
  profitMargin: z.number(),
  scratchCardsCount: z.number().int(),
  inventoryValue: z.number().int(),
  generatedAt: z.coerce.date(),
  generatedById: z.string().uuid(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
});

const ProfitReportPreviewSchema = ProfitReportSchema.omit({
  id: true,
  generatedAt: true,
  generatedById: true,
  voidedAt: true,
  voidedById: true,
  voidReason: true,
}).extend({
  uncoveredDates: z.array(z.string()),
});

const periodQuery = {
  shopId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
};

export const profitReportContract = c.router(
  {
    generate: {
      method: "POST",
      path: "/profit-reports/generate",
      body: z.object(periodQuery),
      responses: { 201: ProfitReportSchema },
    },
    preview: {
      method: "GET",
      path: "/profit-reports/preview",
      query: z.object(periodQuery),
      responses: { 200: ProfitReportPreviewSchema },
    },
    getAll: {
      method: "GET",
      path: "/profit-reports",
      query: z.object({
        shopId: z.string().uuid(),
        periodStart: z.coerce.date().optional(),
        periodEnd: z.coerce.date().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: {
        200: z.object({ reports: z.array(ProfitReportSchema), total: z.number().int() }),
      },
    },
    // getLatest MUST be registered before getById — Express otherwise
    // swallows "/latest" as ":id" (same pattern as delivery.contract.ts:102-103
    // and daily-summary.contract.ts's getByDate rename).
    getLatest: {
      method: "GET",
      path: "/profit-reports/latest",
      query: z.object({ shopId: z.string().uuid() }),
      responses: { 200: ProfitReportSchema.nullable() },
    },
    getById: {
      method: "GET",
      path: "/profit-reports/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: ProfitReportSchema },
    },
    void: {
      method: "POST",
      path: "/profit-reports/:id/void",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ voidReason: z.string().trim().min(3).max(500) }),
      responses: { 200: ProfitReportSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
