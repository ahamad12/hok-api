import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const userRoleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);

export const shopAddressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
});

const shopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: shopAddressSchema,
  phone: z.string(),
  logoUrl: z.string().nullable(),
  ownerId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const staffSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
  isSupervisor: z.boolean(),
  isActive: z.boolean(),
});

const createShopBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: shopAddressSchema,
  phone: z.string().trim().min(5).max(20),
});

const updateShopBodySchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    address: shopAddressSchema,
    phone: z.string().trim().min(5).max(20),
    isActive: z.boolean(),
  })
  .partial();

export const shopContract = c.router(
  {
    create: {
      method: "POST",
      path: "/shops",
      body: createShopBodySchema,
      responses: { 201: shopSchema },
    },
    getById: {
      method: "GET",
      path: "/shops/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: shopSchema },
    },
    getMyShops: {
      method: "GET",
      path: "/shops/my",
      responses: { 200: z.object({ shops: z.array(shopSchema) }) },
    },
    update: {
      method: "PUT",
      path: "/shops/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: updateShopBodySchema,
      responses: { 200: shopSchema },
    },
    delete: {
      method: "DELETE",
      path: "/shops/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: z.object({ message: z.string() }) },
    },
    getStaff: {
      method: "GET",
      path: "/shops/:id/staff",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: z.object({ staff: z.array(staffSummarySchema) }) },
    },
    assignStaff: {
      method: "POST",
      path: "/shops/:id/staff",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ userId: z.string().uuid() }),
      responses: { 200: staffSummarySchema },
    },
    removeStaff: {
      method: "DELETE",
      path: "/shops/:id/staff/:userId",
      pathParams: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: z.object({ message: z.string() }) },
    },
  },
  { pathPrefix: "/api/v1" },
);
