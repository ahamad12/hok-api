import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const expenseCategorySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});

const updateExpenseCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const expenseCategoryContract = c.router(
  {
    create: {
      method: "POST",
      path: "/expense-categories",
      body: z.object({
        shopId: z.string().uuid().nullable(),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      }),
      responses: { 201: expenseCategorySchema },
    },
    getAll: {
      method: "GET",
      path: "/expense-categories",
      query: z.object({
        shopId: z.string().uuid(),
        isActive: z.coerce.boolean().optional(),
      }),
      responses: { 200: z.object({ categories: z.array(expenseCategorySchema) }) },
    },
    update: {
      method: "PATCH",
      path: "/expense-categories/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: updateExpenseCategoryBodySchema,
      responses: { 200: expenseCategorySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
