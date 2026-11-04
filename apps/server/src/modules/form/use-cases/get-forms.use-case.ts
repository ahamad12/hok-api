import { Injectable } from "@nestjs/common";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { FormRepository } from "../repositories/form.repository";

@Injectable()
export class GetFormsUseCase {
  constructor(private readonly formRepo: FormRepository) {}

  async execute(requester: RequestUser, query: { shopId: string; isActive?: boolean }) {
    // STAFF is shop-scoped (they need to see forms to fill them out) —
    // unlike Expense, this module's whole point is STAFF interaction.
    if (!canAccessShop(requester, query.shopId)) {
      throw new AuthorizationError("Cannot view forms outside your shop");
    }
    return this.formRepo.findAll(query);
  }
}
