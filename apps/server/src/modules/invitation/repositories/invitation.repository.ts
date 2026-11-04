// modules/invitation/repositories/invitation.repository.ts
import { Injectable } from "@nestjs/common";
import { type Invitation, PrismaService, type User } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface CreateInvitationData {
  tenantId: string;
  email: string;
  role: Invitation["role"];
  shopId: string | null;
  isSupervisor: boolean;
  tokenHash: string;
  invitedById: string;
  expiresAt: Date;
}

/** WHERE clause for one derived status. */
export function statusWhere(status: InvitationStatus, now: Date): Prisma.InvitationWhereInput {
  switch (status) {
    case "ACCEPTED":
      return { acceptedAt: { not: null } };
    case "REVOKED":
      return { revokedAt: { not: null } };
    case "EXPIRED":
      return { acceptedAt: null, revokedAt: null, expiresAt: { lte: now } };
    default:
      return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
  }
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an invitation, first revoking any earlier pending one for the
   * same tenant + email (re-inviting replaces it). The partial unique index
   * invitations_tenant_email_pending_key makes a concurrent duplicate fail
   * with P2002, which becomes a ConflictError.
   */
  async createReplacingPending(data: CreateInvitationData, now = new Date()): Promise<Invitation> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.invitation.updateMany({
          where: { tenantId: data.tenantId, email: data.email, acceptedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        return tx.invitation.create({ data });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("An invitation for this email is already pending");
      }
      throw error;
    }
  }

  findById(id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { id } });
  }

  findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { tokenHash } });
  }

  async findAllForTenant(params: {
    tenantId: string;
    status?: InvitationStatus;
    limit: number;
    offset: number;
    now?: Date;
  }): Promise<{ invitations: Invitation[]; total: number }> {
    const where: Prisma.InvitationWhereInput = {
      tenantId: params.tenantId,
      ...(params.status ? statusWhere(params.status, params.now ?? new Date()) : {}),
    };
    const [invitations, total] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.invitation.count({ where }),
    ]);
    return { invitations, total };
  }

  /** Guarded: only a pending (not accepted, not revoked) invite changes. */
  async revokeIfPending(id: string, now = new Date()): Promise<number> {
    const result = await this.prisma.invitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count;
  }

  /** Resend: a new token (the old link stops working) and a fresh expiry. */
  async rotateTokenIfPending(id: string, tokenHash: string, expiresAt: Date): Promise<number> {
    const result = await this.prisma.invitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { tokenHash, expiresAt },
    });
    return result.count;
  }

  /**
   * Accepts the invitation and creates the user in one transaction. The
   * guarded updateMany is the claim, so two concurrent accepts of the same
   * link create one account. Returns null when the invitation is no longer
   * acceptable. A taken email/username rolls everything back as a
   * ConflictError.
   */
  async acceptAndCreateUser(
    invitationId: string,
    now: Date,
    userData: Prisma.UserUncheckedCreateInput,
  ): Promise<User | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (claimed.count === 0) return null;
        return tx.user.create({ data: userData });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes("username")) {
          throw new ConflictError("A user with this username already exists");
        }
        throw new ConflictError("An account with this email already exists");
      }
      throw error;
    }
  }
}
