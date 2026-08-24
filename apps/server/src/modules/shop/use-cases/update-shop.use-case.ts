// modules/shop/use-cases/update-shop.use-case.ts
import { Injectable } from "@nestjs/common";
import { shopAddressSchema } from "@tapt-api/api/contracts/shop.contract";
import type { z } from "zod";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface UpdateShopInput {
  requesterId: string;
  shopId: string;
  name?: string;
  address?: z.infer<typeof shopAddressSchema>;
  phone?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateShopUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: UpdateShopInput): Promise<ShopResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    if (shop.ownerId !== input.requesterId) {
      throw new AuthorizationError("You do not own this shop");
    }

    const updated = await this.shopRepository.update(input.shopId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    return toShopResult(updated);
  }
}
