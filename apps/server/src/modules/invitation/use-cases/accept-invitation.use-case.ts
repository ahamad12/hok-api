// modules/invitation/use-cases/accept-invitation.use-case.ts
import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { hashToken } from "../../../common/crypto/hash-token";
import { assertValidUserRoleAssignment } from "../../../common/domain/user-role-invariants";
import { BusinessRuleError, ConflictError, ERROR_REASONS } from "../../../common/errors";
import { toAccessTokenPayload } from "../../auth/mappers/access-token-payload.mapper";
import type { SessionMetadata } from "../../auth/repositories/refresh-token.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { PasswordHasherService } from "../../auth/services/password-hasher.service";
import { TokenService } from "../../auth/services/token.service";
import { InvitationRepository } from "../repositories/invitation.repository";

export interface AcceptInvitationInput {
  token: string;
  password: string;
  displayName: string;
  username?: string;
  deviceName?: string;
}

/** One message for unknown, accepted, revoked and expired links, so the
 *  endpoint can't be used to learn anything about other invitations. */
function invalidInvitation(): BusinessRuleError {
  return new BusinessRuleError(
    "This invitation is invalid or has expired. Ask for a new one.",
    undefined,
    ERROR_REASONS.INVITE_INVALID,
  );
}

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: AcceptInvitationInput, client: Omit<SessionMetadata, "deviceName"> = {}) {
    const now = new Date();
    const invitation = await this.invitationRepo.findByTokenHash(hashToken(input.token));
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw invalidInvitation();
    }

    // Defence in depth: the invitation was validated at creation, but the
    // rules are re-checked against what is about to be written.
    assertValidUserRoleAssignment({
      role: invitation.role,
      shopId: invitation.shopId,
      isSupervisor: invitation.isSupervisor,
      ownerId: invitation.tenantId,
    });

    if (await this.userRepo.findByEmail(invitation.email)) {
      throw new ConflictError("An account with this email already exists. Sign in instead.");
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.invitationRepo.acceptAndCreateUser(invitation.id, now, {
      email: invitation.email,
      passwordHash,
      displayName: input.displayName,
      username: input.username ?? null,
      role: invitation.role,
      ...(invitation.shopId ? { shopId: invitation.shopId } : {}),
      isSupervisor: invitation.isSupervisor,
      ownerId: invitation.tenantId,
      lastLoginAt: now,
    });
    // Lost a race with another accept / a revoke between read and claim.
    if (!user) throw invalidInvitation();

    const { sessionId, refreshToken } = await this.tokenService.issueSession(user.id, {
      ...client,
      deviceName: input.deviceName ?? null,
    });
    const accessToken = this.tokenService.generateAccessToken(
      toAccessTokenPayload(user, sessionId),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        role: user.role as Extract<UserRole, "MANAGER" | "STAFF">,
        shopId: user.shopId,
        isSupervisor: user.isSupervisor,
      },
      accessToken,
      refreshToken,
      sessionId,
    };
  }
}
