import { Injectable } from "@nestjs/common";
import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { FormRepository } from "../repositories/form.repository";

interface CreateFormInput {
  shopId: string;
  title: string;
  description?: string;
  schema: FormField[];
}

@Injectable()
export class CreateFormUseCase {
  constructor(
    private readonly formRepo: FormRepository,
    private readonly shopRepo: ShopRepository,
  ) {}

  async execute(requester: RequestUser, input: CreateFormInput) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can create forms");
    }
    if (!canAccessShop(requester, input.shopId)) {
      throw new AuthorizationError("Cannot create forms outside your business");
    }

    const shop = await this.shopRepo.findById(input.shopId);
    if (!shop || !shop.isActive) throw new BusinessRuleError("Shop is not active");

    // Field-name-uniqueness is already enforced by the contract's .refine —
    // this is the last line of defense if this use-case is ever invoked
    // directly (tests, internal jobs), bypassing the HTTP body parse.
    const names = new Set(input.schema.map((f) => f.name));
    if (names.size !== input.schema.length) {
      throw new BusinessRuleError("Field names must be unique within a form");
    }

    return this.formRepo.create({
      shopId: input.shopId,
      title: input.title,
      description: input.description ?? null,
      schema: input.schema,
      isActive: true,
    });
  }
}
