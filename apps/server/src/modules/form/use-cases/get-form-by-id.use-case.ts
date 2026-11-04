import { Injectable } from "@nestjs/common";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { FormRepository } from "../repositories/form.repository";

@Injectable()
export class GetFormByIdUseCase {
  constructor(private readonly formRepo: FormRepository) {}

  async execute(requester: RequestUser, formId: string) {
    const form = await this.formRepo.findByIdOrThrow(formId);
    if (!canAccessShop(requester, form.shopId)) {
      throw new AuthorizationError("Cannot view a form outside your shop");
    }
    return form;
  }
}
