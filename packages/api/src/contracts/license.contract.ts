import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const licenseSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  productName: z.string(),
  licenseNumber: z.string(),
  remindDays: z.number().int().nonnegative(),
  isActive: z.boolean(),
  currentIssueDate: z.coerce.date().nullable(),
  currentExpiryDate: z.coerce.date().nullable(),
  daysRemaining: z.number().int().nullable(), // null until a renewal exists
  isExpired: z.boolean(),
  isExpiringSoon: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const licenseRenewalSchema = z.object({
  id: z.string().uuid(),
  licenseId: z.string().uuid(),
  source: z.enum(["INITIAL", "RENEWAL"]),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  paymentAmount: z.number().int().nullable(),
  paymentDate: z.coerce.date().nullable(),
  documentUrl: z.string().nullable(),
  notes: z.string().nullable(),
  recordedById: z.string().uuid(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const licenseContract = c.router(
  {
    create: {
      method: "POST",
      path: "/licenses",
      body: z.object({
        shopId: z.string().uuid(),
        productName: z.string().trim().min(1).max(200),
        licenseNumber: z.string().trim().min(1).max(100),
        issueDate: z.coerce.date(),
        expiryDate: z.coerce.date(),
        remindDays: z.number().int().nonnegative().optional(),
        paymentAmount: z.number().int().positive().optional(),
        paymentDate: z.coerce.date().optional(),
        documentUrl: z.string().url().optional(),
        notes: z.string().trim().max(500).optional(),
      }),
      responses: { 201: licenseSchema },
    },
    getAll: {
      method: "GET",
      path: "/licenses",
      query: z.object({
        shopId: z.string().uuid(),
        isActive: z.coerce.boolean().optional(),
        isExpiringSoon: z.coerce.boolean().optional(),
        isExpired: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: { 200: z.object({ licenses: z.array(licenseSchema), total: z.number().int() }) },
    },
    // MUST be registered before getById — Express-style path matching,
    // "/licenses/expiring" would otherwise be swallowed by "/licenses/:id"
    getExpiring: {
      method: "GET",
      path: "/licenses/expiring",
      query: z.object({ shopId: z.string().uuid() }),
      responses: { 200: z.object({ licenses: z.array(licenseSchema) }) },
    },
    getById: {
      method: "GET",
      path: "/licenses/:id",
      responses: { 200: licenseSchema },
    },
    update: {
      method: "PATCH",
      path: "/licenses/:id",
      body: z.object({
        productName: z.string().trim().min(1).max(200).optional(),
        licenseNumber: z.string().trim().min(1).max(100).optional(),
        remindDays: z.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
      }),
      responses: { 200: licenseSchema },
    },
    renew: {
      method: "POST",
      path: "/licenses/:id/renew",
      body: z.object({
        issueDate: z.coerce.date(),
        expiryDate: z.coerce.date(),
        paymentAmount: z.number().int().positive().optional(),
        paymentDate: z.coerce.date().optional(),
        documentUrl: z.string().url().optional(),
        notes: z.string().trim().max(500).optional(),
      }),
      responses: { 201: z.object({ license: licenseSchema, renewal: licenseRenewalSchema }) },
    },
    getRenewalHistory: {
      method: "GET",
      path: "/licenses/:id/renewals",
      responses: { 200: z.object({ renewals: z.array(licenseRenewalSchema) }) },
    },
    voidRenewal: {
      method: "POST",
      path: "/licenses/:id/renewals/:renewalId/void",
      body: z.object({ voidReason: z.string().trim().min(3).max(500) }),
      responses: { 200: z.object({ license: licenseSchema, renewal: licenseRenewalSchema }) },
    },
  },
  { pathPrefix: "/api/v1" },
);
