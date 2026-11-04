// packages/api/src/contracts/invitation.contract.ts
//
// Managers and staff join a business only by invitation. OWNER may invite
// MANAGER or STAFF; MANAGER may invite STAFF. The invitee gets an email
// link carrying a one-time token and accepts with POST /invitations/accept,
// which creates their account inside the inviter's business and signs
// them in.
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { emailSchema } from "../validators/email";
import { checkPasswordStrength } from "../validators/password-strength";

const c = initContract();

const invitableRoleSchema = z.enum(["MANAGER", "STAFF"]);
const invitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]);

export const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: invitableRoleSchema,
  shopId: z.string().uuid().nullable(),
  isSupervisor: z.boolean(),
  status: invitationStatusSchema,
  invitedById: z.string().uuid(),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  revokedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

const createInvitationBodySchema = z
  .object({
    email: emailSchema,
    role: invitableRoleSchema,
    shopId: z.string().uuid().optional(),
    isSupervisor: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Early client feedback; checkUserRoleInvariants is the server-side truth.
    if (data.role === "MANAGER" && data.shopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopId"],
        message: "Managers manage the whole business and cannot be assigned to a shop",
      });
    }
    if (data.isSupervisor && data.role !== "STAFF") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isSupervisor"],
        message: "Only STAFF can be supervisors",
      });
    }
    if (data.isSupervisor && !data.shopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopId"],
        message: "Supervisors must be assigned to a shop",
      });
    }
  });

const acceptInvitationBodySchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(2).max(100),
    username: z.string().trim().min(3).max(30).optional(),
    deviceName: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const { errors } = checkPasswordStrength(data.password);
    errors.forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message });
    });
  });

const acceptedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  username: z.string().nullable(),
  role: invitableRoleSchema,
  shopId: z.string().uuid().nullable(),
  isSupervisor: z.boolean(),
});

export const invitationContract = c.router(
  {
    create: {
      method: "POST",
      path: "/invitations",
      body: createInvitationBodySchema,
      responses: { 201: invitationSchema },
    },
    getAll: {
      method: "GET",
      path: "/invitations",
      query: z.object({
        status: invitationStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      responses: { 200: z.object({ invitations: z.array(invitationSchema), total: z.number() }) },
    },
    // Must stay above "/invitations/:id/..." routes (route order matters).
    accept: {
      method: "POST",
      path: "/invitations/accept",
      body: acceptInvitationBodySchema,
      responses: {
        201: z.object({
          user: acceptedUserSchema,
          accessToken: z.string(),
          refreshToken: z.string(),
          sessionId: z.string().uuid(),
        }),
      },
    },
    resend: {
      method: "POST",
      path: "/invitations/:id/resend",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: invitationSchema },
    },
    revoke: {
      method: "DELETE",
      path: "/invitations/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: invitationSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
