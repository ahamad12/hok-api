import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import type { ShopRepository } from "../repositories/shop.repository";

export interface GetShopByIdInput {
  shopId: string;
}

@Injectable()
export class GetShopByIdUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: GetShopByIdInput): Promise<ShopResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);
    return toShopResult(shop);
  }
}
