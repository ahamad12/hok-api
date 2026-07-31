import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../../auth/repositories/user.repository";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface CreateShopInput {
  requesterId: string;
  name: string;
  address: Prisma.InputJsonValue;
  phone: string;
}

export interface CreateShopResult {
  shop: ShopResult;
}

@Injectable()
export class CreateShopUseCase {
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: CreateShopInput): Promise<CreateShopResult> {
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester) throw new NotFoundError("User", input.requesterId);

    if (requester.role !== UserRole.OWNER) {
      throw new AuthorizationError("Only an OWNER can create a shop");
    }

    if (await this.shopRepository.existsByNameForOwner(input.name, input.requesterId)) {
      throw new ConflictError("You already have a shop with this name");
    }

    const shop = await this.shopRepository.create({
      name: input.name,
      address: input.address,
      phone: input.phone,
      ownerId: input.requesterId,
      isActive: true,
    });

    return { shop: toShopResult(shop) };
  }
}
