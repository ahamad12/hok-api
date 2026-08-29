import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { FormRepository } from "../repositories/form.repository";
import { FormSubmissionRepository } from "../repositories/form-submission.repository";

@Injectable()
export class GetSubmissionsUseCase {
  constructor(
    private readonly formRepo: FormRepository,
    private readonly submissionRepo: FormSubmissionRepository,
  ) {}

  async execute(requester: RequestUser, formId: string, query: { limit: number; offset: number }) {
    const form = await this.formRepo.findByIdOrThrow(formId);

    if (requester.role === UserRole.STAFF) {
      if (requester.shopId !== form.shopId) {
        throw new AuthorizationError("Cannot view submissions outside your shop");
      }
      // STAFF sees only their own submissions — personal checklist history,
      // not a management view.
      return this.submissionRepo.findAll({ formId, staffId: requester.userId, ...query });
    }

    // OWNER/MANAGER see every submission for the form, across shops.
    return this.submissionRepo.findAll({ formId, ...query });
  }
}
