// packages/api/src/contracts/auth.contract.ts — fixed: no duplicated password rules
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { emailSchema } from "../validators/email";
import { checkPasswordStrength } from "../validators/password-strength";

const c = initContract();

// This enum is a deliberate, isolated duplicate of Prisma's UserRole — this
// package must stay importable from tapt-mobile, which can't depend on
// @prisma/client (generated Node-only client). If UserRole's values ever
// change in schema.prisma, this needs a matching manual update; there's no
// way to make it structurally impossible to drift without either bundling
// Prisma into the mobile app or generating this file from the schema.
const userRoleSchema = z.enum(["OWNER", "MANAGER", "STAFF"]);

const userSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  username: z.string().nullable(),
  role: userRoleSchema,
  shopId: z.string().uuid().nullable(),
  isSupervisor: z.boolean(),
});

const userProfileSchema = userSummarySchema.extend({
  isActive: z.boolean(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const registerBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(100),
    username: z.string().trim().min(3).max(30).optional(),
    role: userRoleSchema,
    shopId: z.string().uuid().optional(),
    isSupervisor: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Single source for password rules — same function PasswordHasherService
    // calls server-side. No second copy of "what's a strong password" to
    // keep in sync.
    const { errors } = checkPasswordStrength(data.password);
    errors.forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message });
    });

    // Role/shop/supervisor invariants ARE duplicated on purpose — see
    // checkUserRoleInvariants() in apps/server/src/common/domain/
    // user-role-invariants.ts for the actual source of truth, enforced
    // server-side before any write. This is early client-facing feedback
    // only; never trust it alone.
    const isSupervisor = data.isSupervisor ?? false;
    if (isSupervisor && data.role !== "STAFF") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isSupervisor"],
        message: "Only STAFF can be supervisors",
      });
    }
    if (isSupervisor && !data.shopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopId"],
        message: "Supervisors must be assigned to a shop",
      });
    }
    if (data.role === "OWNER" && data.shopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopId"],
        message: "Owners cannot be assigned to shops",
      });
    }
    if (data.role === "MANAGER" && data.shopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopId"],
        message: "Managers cannot be assigned to shops (system-wide access)",
      });
    }
  });

// Optional human label for the device ("Ana's iPhone"), shown in the
// session list. IP and user agent are taken from the request.
const deviceNameSchema = z.string().trim().min(1).max(100).optional();

const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  deviceName: deviceNameSchema,
});

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .superRefine((data, ctx) => {
    // Same single source for password rules as register's body schema —
    // the exact function PasswordHasherService calls server-side.
    const { errors } = checkPasswordStrength(data.newPassword);
    errors.forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["newPassword"], message });
    });
  });

const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  // Id of the session these tokens belong to (also the access token's
  // `sid` claim). Compare against SESSION_REVOKED payloads' sessionIds.
  sessionId: z.string().uuid(),
});

const sessionSchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string().nullable(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
  lastActiveAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  isCurrent: z.boolean(),
});

export const authContract = c.router(
  {
    register: {
      method: "POST",
      path: "/auth/register",
      body: registerBodySchema,
      responses: { 201: z.object({ user: userSummarySchema }) },
    },
    login: {
      method: "POST",
      path: "/auth/login",
      body: loginBodySchema,
      responses: { 200: authTokensSchema.extend({ user: userSummarySchema }) },
    },
    refresh: {
      method: "POST",
      path: "/auth/refresh",
      body: z.object({ refreshToken: z.string() }),
      responses: { 200: authTokensSchema },
    },
    logout: {
      method: "POST",
      path: "/auth/logout",
      body: z.object({ refreshToken: z.string() }),
      responses: { 200: z.object({ message: z.string() }) },
    },
    logoutAll: {
      method: "POST",
      path: "/auth/logout-all",
      body: z.object({}),
      responses: { 200: z.object({ message: z.string(), sessionsRevoked: z.number() }) },
    },
    getSessions: {
      method: "GET",
      path: "/auth/sessions",
      responses: { 200: z.object({ sessions: z.array(sessionSchema) }) },
    },
    revokeSession: {
      method: "DELETE",
      path: "/auth/sessions/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: z.object({ message: z.string() }) },
    },
    getProfile: {
      method: "GET",
      path: "/auth/profile",
      responses: { 200: userProfileSchema },
    },
    updateProfile: {
      method: "PATCH",
      path: "/auth/profile",
      body: z.object({
        displayName: z.string().trim().min(2).max(100).optional(),
        username: z.string().trim().min(3).max(30).nullable().optional(),
      }),
      responses: { 200: userProfileSchema },
    },
    changePassword: {
      method: "POST",
      path: "/auth/change-password",
      body: changePasswordBodySchema,
      responses: { 200: z.object({ message: z.string(), sessionsRevoked: z.number() }) },
    },
  },
  { pathPrefix: "/api/v1" },
);
