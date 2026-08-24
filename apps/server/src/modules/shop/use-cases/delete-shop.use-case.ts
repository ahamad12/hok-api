// modules/shop/use-cases/delete-shop.use-case.ts
import { Injectable } from "@nestjs/common";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../repositories/shop.repository";

export interface DeleteShopInput {
  requesterId: string;
  shopId: string;
}

export interface DeleteShopResult {
  message: string;
}

@Injectable()
export class DeleteShopUseCase {
  constructor(private readonly shopRepository: ShopRepository) {}

  async execute(input: DeleteShopInput): Promise<DeleteShopResult> {
    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    // BUG FIX vs tapt-backend: legacy DeleteShopUseCase threw NotFoundError
    // when the requester wasn't the owner — which is wrong on two counts:
    // it's the wrong HTTP status (404 implies "doesn't exist" when it does,
    // just not to you) AND it leaks existence of a shop you don't own to
    // an unauthorized caller either way, so hiding it behind 404 buys
    // nothing. AuthorizationError -> 403 is both more correct and no less
    // safe here.
    if (shop.ownerId !== input.requesterId) {
      throw new AuthorizationError("You do not own this shop");
    }

    await this.shopRepository.softDelete(input.shopId);
    return { message: "Shop deactivated successfully" };
  }
}
