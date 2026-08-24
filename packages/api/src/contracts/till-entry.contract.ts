import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const tillEntryCategorySchema = z.enum(["SALES", "EXPENSE", "WITHDRAWAL", "DEPOSIT"]);

const tillEntrySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  category: tillEntryCategorySchema,
  amount: z.number().int(), // positive on original entries; negative only on reversal rows
  description: z.string().nullable(),
  billUrl: z.string().nullable(),
  recordedById: z.string().uuid(),
  transactionDate: z.coerce.date(),
  reversesEntryId: z.string().uuid().nullable(),
  correctionReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});

const createTillEntryBodySchema = z.object({
  shopId: z.string().uuid(),
  category: tillEntryCategorySchema,
  amount: z.number().int().positive(),
  description: z.string().trim().max(500).optional(),
  billUrl: z.string().url().optional(),
  transactionDate: z.coerce.date().optional(),
});

const getTillEntriesQuerySchema = z.object({
  shopId: z.string().uuid(),
  category: tillEntryCategorySchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const getTillSummaryQuerySchema = z.object({
  shopId: z.string().uuid(),
  date: z.coerce.date(),
  actualClosingBalance: z.coerce.number().int().optional(),
});

const tillSummarySchema = z.object({
  shopId: z.string().uuid(),
  date: z.coerce.date(),
  openingBalance: z.number().int(),
  expectedClosingBalance: z.number().int(),
  actualClosingBalance: z.number().int().nullable(),
  variance: z.number().int().nullable(),
  totalCashIn: z.number().int(),
  totalCashOut: z.number().int(),
  breakdown: z.object({
    SALES: z.number().int(),
    DEPOSIT: z.number().int(),
    EXPENSE: z.number().int(),
    WITHDRAWAL: z.number().int(),
  }),
});

const reverseTillEntryBodySchema = z.object({
  correctionReason: z.string().trim().min(1).max(500),
  description: z.string().trim().max(500).optional(),
});

export const tillEntryContract = c.router(
  {
    create: {
      method: "POST",
      path: "/till-entries",
      body: createTillEntryBodySchema,
      responses: { 201: tillEntrySchema },
    },
    getAll: {
      method: "GET",
      path: "/till-entries",
      query: getTillEntriesQuerySchema,
      responses: {
        200: z.object({ entries: z.array(tillEntrySchema), total: z.number().int() }),
      },
    },
    getSummary: {
      method: "GET",
      path: "/till-entries/summary",
      query: getTillSummaryQuerySchema,
      responses: { 200: tillSummarySchema },
    },
    getById: {
      method: "GET",
      path: "/till-entries/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: tillEntrySchema },
    },
    reverse: {
      method: "POST",
      path: "/till-entries/:id/reverse",
      pathParams: z.object({ id: z.string().uuid() }),
      body: reverseTillEntryBodySchema,
      responses: { 201: tillEntrySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
