import type { Invitation } from "@tapt-api/db";
import type { InvitationStatus } from "../repositories/invitation.repository";

export interface InvitationResult {
  id: string;
  email: string;
  role: "MANAGER" | "STAFF";
  shopId: string | null;
  isSupervisor: boolean;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export function invitationStatus(inv: Invitation, now = new Date()): InvitationStatus {
  if (inv.acceptedAt) return "ACCEPTED";
  if (inv.revokedAt) return "REVOKED";
  if (inv.expiresAt <= now) return "EXPIRED";
  return "PENDING";
}

/** Never includes tokenHash. */
export function toInvitationResult(inv: Invitation, now = new Date()): InvitationResult {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role as "MANAGER" | "STAFF",
    shopId: inv.shopId,
    isSupervisor: inv.isSupervisor,
    status: invitationStatus(inv, now),
    invitedById: inv.invitedById,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    revokedAt: inv.revokedAt,
    createdAt: inv.createdAt,
  };
}
