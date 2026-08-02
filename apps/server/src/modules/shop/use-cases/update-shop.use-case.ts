// modules/shop/use-cases/update-shop.use-case.ts
import { Injectable } from "@nestjs/common";
import { Prisma } from "@tapt-api/db/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface UpdateShopInput {
  requesterId: string;
  shopId: string;
  name?: string;
  address?: Record<string, unknown>;
  phone?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateShopUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: UpdateShopInput): Promise<ShopResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop) throw new NotFoundError("Shop", input.shopId);

    if (shop.ownerId !== input.requesterId) {
      throw new AuthorizationError("You do not own this shop");
    }

    try {
      const updated = await this.shopRepository.update(input.shopId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });

      return toShopResult(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("You already have a shop with this name");
      }
      throw error;
    }
  }
}
