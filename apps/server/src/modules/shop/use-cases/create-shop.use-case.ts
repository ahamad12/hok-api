import { Injectable } from "@nestjs/common";
import { shopAddressSchema } from "@tapt-api/api/contracts/shop.contract";
import { UserRole } from "@tapt-api/db";
import type { z } from "zod";
import { TenantShopsService } from "../../../common/auth/tenant-shops.service";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../../auth/repositories/user.repository";
import { type ShopResult, toShopResult } from "../mappers/shop.mapper";
import { ShopRepository } from "../repositories/shop.repository";

export interface CreateShopInput {
  requesterId: string;
  name: string;
  address: z.infer<typeof shopAddressSchema>;
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
    private readonly tenantShops: TenantShopsService,
  ) {}

  async execute(input: CreateShopInput): Promise<CreateShopResult> {
    const requester = await this.userRepository.findById(input.requesterId);
    if (!requester) throw new NotFoundError("User", input.requesterId);

    if (requester.role !== UserRole.OWNER) {
      throw new AuthorizationError("Only an OWNER can create a shop");
    }

    const shop = await this.shopRepository.create({
      name: input.name,
      address: input.address,
      phone: input.phone,
      ownerId: input.requesterId,
      isActive: true,
    });
    // The owner's cached shop list must include the new shop right away.
    await this.tenantShops.invalidate(input.requesterId);

    return { shop: toShopResult(shop) };
  }
}
