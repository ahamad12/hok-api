import { Injectable } from "@nestjs/common";
import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { UserRole } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { FormRepository } from "../repositories/form.repository";

interface UpdateFormInput {
  title?: string;
  description?: string | null;
  schema?: FormField[];
  isActive?: boolean;
}

@Injectable()
export class UpdateFormUseCase {
  constructor(private readonly formRepo: FormRepository) {}

  async execute(requester: RequestUser, formId: string, input: UpdateFormInput) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can update forms");
    }

    const form = await this.formRepo.findByIdOrThrow(formId); // 404 before attempting the write
    if (!canAccessShop(requester, form.shopId)) {
      throw new AuthorizationError("Cannot update forms outside your business");
    }

    if (input.schema) {
      const names = new Set(input.schema.map((f) => f.name));
      if (names.size !== input.schema.length) {
        throw new BusinessRuleError("Field names must be unique within a form");
      }
      // Deliberate: editing a schema does NOT check whether renaming/removing
      // a field orphans keys already present in historical
      // FormSubmission.answers. Past submissions keep whatever keys they
      // were submitted with; a schema edit only affects future submissions —
      // same "history doesn't rewrite" principle as ExpenseCategory.isActive.
    }

    return this.formRepo.update(formId, {
      title: input.title,
      description: input.description,
      schema: input.schema,
      isActive: input.isActive,
    });
  }
}
