// packages/api/src/contracts/team.contract.ts
//
// The people in one business (tenant): its OWNER, MANAGERs and STAFF.
// Replaces fanning out over GET /shops/:id/staff per shop, which never
// returned managers or the owner. Pending invitations stay on
// GET /invitations.
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const teamMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
  /** STAFF: their shop. Null for OWNER/MANAGER (tenant-wide). */
  shopId: z.string().uuid().nullable(),
  isSupervisor: z.boolean(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const teamContract = c.router(
  {
    getMembers: {
      method: "GET",
      path: "/team/members",
      responses: { 200: z.object({ members: z.array(teamMemberSchema) }) },
    },
  },
  { pathPrefix: "/api/v1" },
);
