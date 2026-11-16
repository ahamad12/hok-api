// modules/shop/use-cases/get-my-shops.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface GetMyShopsInput {
  role: UserRole;
  /** The OWNER whose business the requester belongs to. Null = no tenant. */
  tenantId: string | null;
  /** STAFF only: their assigned shop. */
  shopId: string | null;
}

export interface GetMyShopsResult {
  shops: ShopResult[];
}

/** OWNER/MANAGER: every active shop of their tenant. STAFF: their own shop, if active. */
@Injectable()
export class GetMyShopsUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: GetMyShopsInput): Promise<GetMyShopsResult> {
    if (input.role === UserRole.STAFF) {
      if (!input.shopId) return { shops: [] };
      const shop = await this.shopRepository.findById(input.shopId);
      return { shops: shop?.isActive ? [toShopResult(shop)] : [] };
    }

    if (!input.tenantId) return { shops: [] };
    const shops = await this.shopRepository.findByOwner(input.tenantId);
    return { shops: shops.map(toShopResult) };
  }
}
