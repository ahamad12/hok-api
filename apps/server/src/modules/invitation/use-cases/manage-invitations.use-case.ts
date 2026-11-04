// modules/invitation/use-cases/manage-invitations.use-case.ts — list, revoke, resend.
import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Invitation, UserRole } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { hashToken } from "../../../common/crypto/hash-token";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { type InvitationResult, toInvitationResult } from "../mappers/invitation.mapper";
import { InvitationRepository, type InvitationStatus } from "../repositories/invitation.repository";
import { CreateInvitationUseCase } from "./create-invitation.use-case";

const DAY_MS = 24 * 60 * 60 * 1000;

function requireTenant(requester: RequestUser): string {
  if (!requester.tenantId) throw new AuthorizationError("You don't belong to a business yet");
  return requester.tenantId;
}

@Injectable()
export class GetInvitationsUseCase {
  constructor(private readonly invitationRepo: InvitationRepository) {}

  async execute(
    requester: RequestUser,
    query: { status?: InvitationStatus; limit: number; offset: number },
  ): Promise<{ invitations: InvitationResult[]; total: number }> {
    const tenantId = requireTenant(requester);
    const now = new Date();
    const { invitations, total } = await this.invitationRepo.findAllForTenant({
      tenantId,
      ...query,
      now,
    });
    return { invitations: invitations.map((i) => toInvitationResult(i, now)), total };
  }
}

/** Loads an invitation of the requester's own tenant; anything else is 404. */
async function loadOwnInvitation(
  repo: InvitationRepository,
  requester: RequestUser,
  id: string,
): Promise<Invitation> {
  const tenantId = requireTenant(requester);
  const invitation = await repo.findById(id);
  if (!invitation || invitation.tenantId !== tenantId) throw new NotFoundError("Invitation", id);
  return invitation;
}

@Injectable()
export class RevokeInvitationUseCase {
  constructor(private readonly invitationRepo: InvitationRepository) {}

  async execute(requester: RequestUser, id: string): Promise<InvitationResult> {
    await loadOwnInvitation(this.invitationRepo, requester, id);
    const affected = await this.invitationRepo.revokeIfPending(id);
    if (affected === 0) {
      throw new BusinessRuleError("Only a pending invitation can be revoked");
    }
    const updated = await loadOwnInvitation(this.invitationRepo, requester, id);
    return toInvitationResult(updated);
  }
}

@Injectable()
export class ResendInvitationUseCase {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly createInvitation: CreateInvitationUseCase,
  ) {}

  /** Issues a new link (the previous one stops working) with a fresh
   *  expiry. Works for pending and expired invitations. */
  async execute(requester: RequestUser, id: string): Promise<InvitationResult> {
    const invitation = await loadOwnInvitation(this.invitationRepo, requester, id);
    const rawToken = randomBytes(32).toString("hex");
    const affected = await this.invitationRepo.rotateTokenIfPending(
      id,
      hashToken(rawToken),
      new Date(Date.now() + env.INVITATION_EXPIRY_DAYS * DAY_MS),
    );
    if (affected === 0) {
      throw new BusinessRuleError("This invitation was already accepted or revoked");
    }
    await this.createInvitation.sendInvitationEmail(
      requester.userId,
      invitation.email,
      invitation.role as UserRole,
      rawToken,
    );
    const updated = await loadOwnInvitation(this.invitationRepo, requester, id);
    return toInvitationResult(updated);
  }
}
