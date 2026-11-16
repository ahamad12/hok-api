// modules/shop/use-cases/get-team-members.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { UserRepository } from "../../auth/repositories/user.repository";

export interface GetTeamMembersInput {
  /** RequestUser.tenantId. Null = no tenant: fails closed with no members. */
  tenantId: string | null;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  shopId: string | null;
  isSupervisor: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface GetTeamMembersResult {
  members: TeamMember[];
}

const ROLE_ORDER: Record<UserRole, number> = {
  [UserRole.OWNER]: 0,
  [UserRole.MANAGER]: 1,
  [UserRole.STAFF]: 2,
};

/**
 * Everyone in the requester's business. OWNER/MANAGER only (route guard):
 * managers are tenant-wide, so both see the whole business. Owner first,
 * then managers, then staff; by name within a role.
 */
@Injectable()
export class GetTeamMembersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: GetTeamMembersInput): Promise<GetTeamMembersResult> {
    if (!input.tenantId) return { members: [] };

    const users = await this.userRepository.findByTenant(input.tenantId);
    const members = users
      .map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        shopId: u.role === UserRole.STAFF ? u.shopId : null,
        isSupervisor: u.isSupervisor,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      }))
      .sort(
        (a, b) =>
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.displayName.localeCompare(b.displayName),
      );
    return { members };
  }
}
