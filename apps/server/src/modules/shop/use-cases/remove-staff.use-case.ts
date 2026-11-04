// modules/shop/use-cases/remove-staff.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { tenantIdOf } from "../../../common/domain/tenant";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../../auth/repositories/user.repository";
import { TokenVersionService } from "../../auth/services/token-version.service";
import { ShopRepository } from "../repositories/shop.repository";

export interface RemoveStaffInput {
  requesterId: string;
  shopId: string;
  userId: string;
}

export interface RemoveStaffResult {
  message: string;
}

@Injectable()
export class RemoveStaffUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenVersionService: TokenVersionService,
  ) {}

  async execute(input: RemoveStaffInput): Promise<RemoveStaffResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester || (requester.role !== UserRole.OWNER && requester.role !== UserRole.MANAGER)) {
      throw new AuthorizationError("Only OWNER or MANAGER can remove staff");
    }

    // OWNER and MANAGER may manage staff in any shop of their own tenant.
    const tenantId = tenantIdOf(requester);
    if (!tenantId || shop.ownerId !== tenantId) {
      throw new AuthorizationError("You can only manage staff in your own business");
    }

    const targetUser = await this.userRepository.findById(input.userId);
    if (!targetUser || targetUser.shopId !== input.shopId || targetUser.ownerId !== shop.ownerId) {
      throw new NotFoundError("Staff member", input.userId);
    }

    // isSupervisor is reset alongside shopId — a supervisor flag with no
    // assigned shop violates the same invariant checkUserRoleInvariants
    // enforces at registration ("supervisors must be assigned to a shop").
    // Clearing both here, not just shopId, keeps that invariant true after
    // removal too, not just at creation time.
    await this.userRepository.update(targetUser.id, { shopId: null, isSupervisor: false });
    await this.tokenVersionService.invalidateSessions(targetUser.id);

    return { message: "Staff member removed from shop" };
  }
}
