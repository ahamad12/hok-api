import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const expenseSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().int().positive(),
  description: z.string().trim().min(1).max(2000),
  billUrl: z.string().url().nullable(),
  expenseDate: z.coerce.date(),
  recordedById: z.string().uuid(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});

const voidBodySchema = z.object({
  voidReason: z.string().trim().min(3).max(500),
});

export const expenseContract = c.router(
  {
    create: {
      method: "POST",
      path: "/expenses",
      body: z.object({
        shopId: z.string().uuid(),
        categoryId: z.string().uuid(),
        amount: z.number().int().positive(),
        description: z.string().trim().min(1).max(2000),
        billUrl: z.string().url().optional(),
        expenseDate: z.coerce.date(),
      }),
      responses: { 201: expenseSchema },
    },
    getAll: {
      method: "GET",
      path: "/expenses",
      query: z.object({
        shopId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        includeVoided: z.coerce.boolean().default(false),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: {
        200: z.object({ expenses: z.array(expenseSchema), total: z.number() }),
      },
    },
    void: {
      method: "POST",
      path: "/expenses/:id/void",
      pathParams: z.object({ id: z.string().uuid() }),
      body: voidBodySchema,
      responses: { 200: expenseSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
