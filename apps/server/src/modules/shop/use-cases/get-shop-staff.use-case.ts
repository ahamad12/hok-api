// modules/shop/use-cases/get-shop-staff.use-case.ts
import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors";
import type { UserRepository } from "../../auth/repositories/user.repository";
import type { ShopRepository } from "../repositories/shop.repository";

export interface GetShopStaffInput {
  shopId: string;
}

export interface StaffSummary {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isSupervisor: boolean;
  isActive: boolean;
}

export interface GetShopStaffResult {
  staff: StaffSummary[];
}

@Injectable()
export class GetShopStaffUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: GetShopStaffInput): Promise<GetShopStaffResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    // Requester authorization (OWNER/MANAGER, or STAFF scoped to their own
    // shop) is enforced at the route via RolesGuard + ShopAccessGuard —
    // fixes the tapt-backend gap where this use case had zero requester
    // check of its own and relied entirely on route wiring that could be
    // (and was) forgotten on some routes.
    const staff = await this.userRepository.findByShop(input.shopId);

    return {
      staff: staff.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        isSupervisor: u.isSupervisor,
        isActive: u.isActive,
      })),
    };
  }
}
