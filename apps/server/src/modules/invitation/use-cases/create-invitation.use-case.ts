// modules/invitation/use-cases/create-invitation.use-case.ts
import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { normalizeEmail } from "@tapt-api/api/validators/email";
import { UserRole } from "@tapt-api/db";
import { env } from "@tapt-api/env/server";
import { AuthMailerService, authLink } from "../../../common/auth/auth-mailer.service";
import { hashToken } from "../../../common/crypto/hash-token";
import { canAccessShop } from "../../../common/domain/shop-access";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { UserRepository } from "../../auth/repositories/user.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type InvitationResult, toInvitationResult } from "../mappers/invitation.mapper";
import { InvitationRepository } from "../repositories/invitation.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateInvitationInput {
  email: string;
  role: "MANAGER" | "STAFF";
  shopId?: string;
  isSupervisor?: boolean;
}

/** Who may invite whom. */
const MAY_INVITE: Record<UserRole, ReadonlyArray<UserRole>> = {
  [UserRole.OWNER]: [UserRole.MANAGER, UserRole.STAFF],
  [UserRole.MANAGER]: [UserRole.STAFF],
  [UserRole.STAFF]: [],
};

@Injectable()
export class CreateInvitationUseCase {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly userRepo: UserRepository,
    private readonly shopRepo: ShopRepository,
    private readonly mailer: AuthMailerService,
  ) {}

  async execute(requester: RequestUser, input: CreateInvitationInput): Promise<InvitationResult> {
    const tenantId = requester.tenantId;
    if (!tenantId) throw new AuthorizationError("You don't belong to a business yet");

    const role = input.role as UserRole;
    if (!MAY_INVITE[requester.role].includes(role)) {
      throw new AuthorizationError(
        requester.role === UserRole.MANAGER
          ? "Managers can invite staff only"
          : "You are not allowed to invite users",
      );
    }

    const shopId = input.shopId ?? null;
    const isSupervisor = input.isSupervisor ?? false;
    assertValidUserRoleAssignment({ role, shopId, isSupervisor, ownerId: tenantId });

    if (shopId) {
      if (!canAccessShop(requester, shopId)) {
        throw new AuthorizationError("Cannot invite staff to a shop outside your business");
      }
      const shop = await this.shopRepo.findById(shopId);
      if (!shop || !shop.isActive) throw new NotFoundError("Shop", shopId);
    }

    const email = normalizeEmail(input.email);
    if (await this.userRepo.findByEmail(email)) {
      throw new ConflictError("This email already has a TAPT account");
    }

    const rawToken = randomBytes(32).toString("hex");
    const invitation = await this.invitationRepo.createReplacingPending({
      tenantId,
      email,
      role,
      shopId,
      isSupervisor,
      tokenHash: hashToken(rawToken),
      invitedById: requester.userId,
      expiresAt: new Date(Date.now() + env.INVITATION_EXPIRY_DAYS * DAY_MS),
    });

    await this.sendInvitationEmail(requester.userId, email, role, rawToken);
    return toInvitationResult(invitation);
  }

  /** Shared with ResendInvitationUseCase. */
  async sendInvitationEmail(
    inviterId: string,
    email: string,
    role: UserRole,
    rawToken: string,
  ): Promise<void> {
    const inviter = await this.userRepo.findById(inviterId);
    const who = inviter?.displayName ?? "Your team";
    const roleLabel = role === UserRole.MANAGER ? "a manager" : "a staff member";
    await this.mailer.send(
      "invitation",
      email,
      `${who} invited you to join TAPT`,
      [
        `${who} invited you to join their business on TAPT as ${roleLabel}.`,
        "",
        `Accept the invitation: ${authLink("invite", rawToken)}`,
        "",
        `This link expires in ${env.INVITATION_EXPIRY_DAYS} days. If you weren't expecting it, you can ignore this email.`,
      ].join("\n"),
    );
  }
}
