// modules/shop/use-cases/get-my-shops.use-case.ts
import { Injectable } from "@nestjs/common";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface GetMyShopsInput {
  requesterId: string;
}

export interface GetMyShopsResult {
  shops: ShopResult[];
}

@Injectable()
export class GetMyShopsUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: GetMyShopsInput): Promise<GetMyShopsResult> {
    const shops = await this.shopRepository.findByOwner(input.requesterId);
    return { shops: shops.map(toShopResult) };
  }
}
