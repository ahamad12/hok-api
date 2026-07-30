// modules/shop/use-cases/assign-staff.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import type { UserRepository } from "../../auth/repositories/user.repository";
import type { TokenVersionService } from "../../auth/services/token-version.service";
import type { ShopRepository } from "../repositories/shop.repository";
import type { StaffSummary } from "./get-shop-staff.use-case";

export interface AssignStaffInput {
  requesterId: string;
  shopId: string;
  userId: string;
}

@Injectable()
export class AssignStaffUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenVersionService: TokenVersionService,
  ) {}

  async execute(input: AssignStaffInput): Promise<StaffSummary> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const targetUser = await this.userRepository.findById(input.userId);
    if (!targetUser) throw new NotFoundError("User", input.userId);

    // Fixes the tapt-backend gap: legacy AssignStaffToShopUseCase defined
    // requesterId in its input but never actually used it anywhere in the
    // method body — meaning the "who's allowed to assign staff" check
    // existed only in the route middleware, with zero use-case-level
    // enforcement. RolesGuard covers OWNER/MANAGER at the route; this
    // reasserts it per the same defense-in-depth pattern used elsewhere.
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester || (requester.role !== UserRole.OWNER && requester.role !== UserRole.MANAGER)) {
      throw new AuthorizationError("Only OWNER or MANAGER can assign staff");
    }

    // Same invariant as user-role-invariants.ts's OWNER/MANAGER rule —
    // only STAFF can be assigned to a specific shop.
    if (targetUser.role !== UserRole.STAFF) {
      throw new BusinessRuleError("Only STAFF can be assigned to a shop");
    }

    const updated = await this.userRepository.update(targetUser.id, { shopId: input.shopId });

    // shopId is part of the JWT payload (AccessTokenPayload.shopId) — any
    // token this user is currently holding now carries a stale shopId
    // claim. Bumping tokenVersion forces re-authentication so their next
    // access token reflects the new assignment.
    await this.tokenVersionService.invalidateSessions(targetUser.id);

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      isSupervisor: updated.isSupervisor,
      isActive: updated.isActive,
    };
  }
}
