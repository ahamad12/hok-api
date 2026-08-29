import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { FormField } from "@tapt-api/api/contracts/form.contract";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { validateAnswersAgainstSchema } from "../../../common/domain/form-answer-validation";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import { FormValidationError } from "../../../common/errors/form-validation.error";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { FormRepository } from "../repositories/form.repository";
import { FormSubmissionRepository } from "../repositories/form-submission.repository";

@Injectable()
export class SubmitFormUseCase {
  constructor(
    private readonly formRepo: FormRepository,
    private readonly submissionRepo: FormSubmissionRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, formId: string, answers: Record<string, unknown>) {
    const form = await this.formRepo.findByIdOrThrow(formId);

    if (!form.isActive) {
      throw new BusinessRuleError("This form is no longer accepting submissions");
    }

    // STAFF shop-scoped; OWNER/MANAGER system-wide (e.g. testing a form
    // before publishing it to their staff).
    if (requester.role === UserRole.STAFF && requester.shopId !== form.shopId) {
      throw new AuthorizationError("Cannot submit a form outside your shop");
    }

    const fields = form.schema as FormField[];
    const errors = validateAnswersAgainstSchema(fields, answers);
    if (errors.length > 0) {
      // Distinct from ValidationError (raw Zod shape failures → 400).
      // FormValidationError is mapped to 422 in global-exception.filter.ts
      // — see the filter branch added alongside this module.
      throw new FormValidationError("Submission failed validation", errors);
    }

    const submission = await this.submissionRepo.create({
      formId,
      staffId: requester.userId,
      answers,
    });

    this.events.emit(SOCKET_EVENTS.FORM_SUBMITTED, {
      formId: form.id,
      shopId: form.shopId,
      submissionId: submission.id,
      staffId: requester.userId,
    });

    return submission;
  }
}
