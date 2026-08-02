// packages/api/src/contracts/category.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const categorySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const categoryContract = c.router(
  {
    create: {
      method: "POST",
      path: "/categories",
      body: z.object({
        shopId: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      }),
      responses: { 201: categorySchema },
    },
    getAll: {
      method: "GET",
      path: "/categories",
      query: z.object({
        shopId: z.string().uuid(),
        isActive: z.coerce.boolean().optional(),
      }),
      responses: { 200: z.object({ categories: z.array(categorySchema) }) },
    },
    getById: {
      method: "GET",
      path: "/categories/:id",
      responses: { 200: categorySchema },
    },
    update: {
      method: "PATCH",
      path: "/categories/:id",
      body: z.object({
        name: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
      responses: { 200: categorySchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
