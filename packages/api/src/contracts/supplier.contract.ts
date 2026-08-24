// packages/api/src/contracts/supplier.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const supplierSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const supplierContract = c.router(
  {
    create: {
      method: "POST",
      path: "/suppliers",
      body: z.object({
        shopId: z.string().uuid(),
        categoryId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        phone: z.string().trim().max(20).optional(),
        address: z.string().trim().max(500).optional(),
      }),
      responses: { 201: supplierSchema },
    },
    getAll: {
      method: "GET",
      path: "/suppliers",
      query: z.object({
        shopId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        isActive: z.coerce.boolean().optional(),
      }),
      responses: { 200: z.object({ suppliers: z.array(supplierSchema) }) },
    },
    getById: {
      method: "GET",
      path: "/suppliers/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: supplierSchema },
    },
    update: {
      method: "PATCH",
      path: "/suppliers/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({
        categoryId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(200).optional(),
        phone: z.string().trim().max(20).nullable().optional(),
        address: z.string().trim().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
      responses: { 200: supplierSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
